/**
 * Provider registry — defines all known LLM providers.
 *
 * Each provider:
 *   - reads keys from env (comma-separated for rotation)
 *   - exposes per-tier model names
 *   - knows how to call itself
 *
 * The router (src/ai/router.ts) picks a provider per request based on
 * tier + health + quota. Backend-only — keys never leave this layer.
 */
import axios from 'axios';
import { env } from '../../config/env';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';
import { callOpenAICompatible } from './openaiCompatible';
import type { LLMCallArgs, LLMCallResult, LLMProvider, ModelTier } from './types';

function splitKeys(s: string): string[] {
  return s
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/* ============================================================
 *  Groq — OpenAI-compatible. Fast + free.
 * ============================================================ */

const groqKeys = (() => {
  const list = [...splitKeys(env.GROQ_API_KEYS)];
  if (env.GROQ_API_KEY && !list.includes(env.GROQ_API_KEY)) list.unshift(env.GROQ_API_KEY);
  return list;
})();

const groqProvider: LLMProvider = {
  id: 'groq',
  priority: 100,
  isConfigured: () => groqKeys.length > 0,
  keyCount: () => groqKeys.length,
  modelFor: () => env.GROQ_MODEL,
  dailyQuotaPerKey: () => env.QUOTA_DAILY_GROQ,
  async complete(args, _tier, keyIndex) {
    return callOpenAICompatible(
      { provider: 'groq', baseURL: 'https://api.groq.com/openai/v1' },
      groqKeys[keyIndex % groqKeys.length],
      env.GROQ_MODEL,
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  OpenRouter — aggregator with many free models. Needs Referer header.
 * ============================================================ */

const openrouterKeys = splitKeys(env.OPENROUTER_API_KEYS);

const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  priority: 80,
  isConfigured: () => openrouterKeys.length > 0,
  keyCount: () => openrouterKeys.length,
  modelFor(tier) {
    return tier === 'reasoning'
      ? env.OPENROUTER_MODEL_REASONING
      : env.OPENROUTER_MODEL_FAST;
  },
  dailyQuotaPerKey: () => env.QUOTA_DAILY_OPENROUTER,
  async complete(args, tier, keyIndex) {
    return callOpenAICompatible(
      {
        provider: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://flux.remoteops.co',
          'X-Title': 'Flux',
        },
      },
      openrouterKeys[keyIndex % openrouterKeys.length],
      this.modelFor(tier),
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  Gemini — Google. Native API. Generous free tier.
 * ============================================================ */

const geminiKeys = splitKeys(env.GEMINI_API_KEYS);

async function callGemini(
  apiKey: string,
  model: string,
  args: LLMCallArgs,
  keyIndex: number,
): Promise<LLMCallResult> {
  const started = Date.now();
  const text = await withRetry(
    async () => {
      try {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            systemInstruction: { parts: [{ text: args.system }] },
            contents: [{ role: 'user', parts: [{ text: args.user }] }],
            generationConfig: {
              temperature: args.temperature,
              maxOutputTokens: args.maxTokens,
              responseMimeType: args.jsonMode ? 'application/json' : 'text/plain',
            },
          },
          { timeout: 60_000, headers: { 'content-type': 'application/json' } },
        );
        const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) throw new ExternalApiError('gemini', 'empty completion');
        return content as string;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const message = (err as Error)?.message ?? String(err);
        const retryable = status === undefined || status === 429 || (status ?? 0) >= 500;
        throw new ExternalApiError('gemini', message, {
          status: status ?? 502,
          retryable,
        });
      }
    },
    { label: `gemini:${model}` },
  );
  return { text, provider: 'gemini', model, keyIndex, latencyMs: Date.now() - started };
}

const geminiProvider: LLMProvider = {
  id: 'gemini',
  priority: 90,
  isConfigured: () => geminiKeys.length > 0,
  keyCount: () => geminiKeys.length,
  modelFor(tier) {
    return tier === 'reasoning' ? env.GEMINI_MODEL_REASONING : env.GEMINI_MODEL_FAST;
  },
  dailyQuotaPerKey: () => env.QUOTA_DAILY_GEMINI,
  async complete(args, tier, keyIndex) {
    return callGemini(
      geminiKeys[keyIndex % geminiKeys.length],
      this.modelFor(tier),
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  HuggingFace Inference API — generous free tier for OSS models.
 * ============================================================ */

const hfKeys = splitKeys(env.HUGGINGFACE_API_KEYS);

async function callHuggingFace(
  apiKey: string,
  model: string,
  args: LLMCallArgs,
  keyIndex: number,
): Promise<LLMCallResult> {
  const started = Date.now();
  const text = await withRetry(
    async () => {
      try {
        const res = await axios.post(
          `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
          {
            model,
            messages: [
              { role: 'system', content: args.system },
              { role: 'user', content: args.user },
            ],
            temperature: args.temperature,
            max_tokens: args.maxTokens,
          },
          {
            timeout: 120_000,
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
          },
        );
        const content = res.data?.choices?.[0]?.message?.content;
        if (!content) throw new ExternalApiError('huggingface', 'empty completion');
        return content as string;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const message = (err as Error)?.message ?? String(err);
        const retryable = status === undefined || status === 429 || (status ?? 0) >= 500;
        throw new ExternalApiError('huggingface', message, {
          status: status ?? 502,
          retryable,
        });
      }
    },
    { label: `hf:${model}` },
  );
  return { text, provider: 'huggingface', model, keyIndex, latencyMs: Date.now() - started };
}

const huggingfaceProvider: LLMProvider = {
  id: 'huggingface',
  priority: 60,
  isConfigured: () => hfKeys.length > 0,
  keyCount: () => hfKeys.length,
  modelFor(tier) {
    return tier === 'reasoning'
      ? env.HUGGINGFACE_MODEL_REASONING
      : env.HUGGINGFACE_MODEL_FAST;
  },
  dailyQuotaPerKey: () => env.QUOTA_DAILY_HUGGINGFACE,
  async complete(args, tier, keyIndex) {
    return callHuggingFace(
      hfKeys[keyIndex % hfKeys.length],
      this.modelFor(tier),
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  Cloudflare Workers AI — best free tier per generation.
 * ============================================================ */

const cfKeys = splitKeys(env.CLOUDFLARE_AI_API_KEYS);
const cfAccount = env.CLOUDFLARE_AI_ACCOUNT_ID;

async function callCloudflare(
  apiKey: string,
  model: string,
  args: LLMCallArgs,
  keyIndex: number,
): Promise<LLMCallResult> {
  const started = Date.now();
  const text = await withRetry(
    async () => {
      try {
        const res = await axios.post(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/run/${model}`,
          {
            messages: [
              { role: 'system', content: args.system },
              { role: 'user', content: args.user },
            ],
            temperature: args.temperature,
            max_tokens: args.maxTokens,
          },
          {
            timeout: 60_000,
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
          },
        );
        const content = res.data?.result?.response;
        if (!content) throw new ExternalApiError('cloudflare', 'empty completion');
        return content as string;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const message = (err as Error)?.message ?? String(err);
        const retryable = status === undefined || status === 429 || (status ?? 0) >= 500;
        throw new ExternalApiError('cloudflare', message, {
          status: status ?? 502,
          retryable,
        });
      }
    },
    { label: `cf:${model}` },
  );
  return { text, provider: 'cloudflare', model, keyIndex, latencyMs: Date.now() - started };
}

const cloudflareProvider: LLMProvider = {
  id: 'cloudflare',
  priority: 95, // very high — biggest free tier
  isConfigured: () => cfKeys.length > 0 && !!cfAccount,
  keyCount: () => cfKeys.length,
  modelFor(tier) {
    return tier === 'reasoning'
      ? env.CLOUDFLARE_AI_MODEL_REASONING
      : env.CLOUDFLARE_AI_MODEL_FAST;
  },
  dailyQuotaPerKey: () => env.QUOTA_DAILY_CLOUDFLARE,
  async complete(args, tier, keyIndex) {
    return callCloudflare(
      cfKeys[keyIndex % cfKeys.length],
      this.modelFor(tier),
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  Together AI — small free credit, used as a last-mile fallback.
 * ============================================================ */

const togetherKeys = splitKeys(env.TOGETHER_API_KEYS);

const togetherProvider: LLMProvider = {
  id: 'together',
  priority: 50,
  isConfigured: () => togetherKeys.length > 0,
  keyCount: () => togetherKeys.length,
  modelFor(tier) {
    return tier === 'reasoning' ? env.TOGETHER_MODEL_REASONING : env.TOGETHER_MODEL_FAST;
  },
  dailyQuotaPerKey: () => env.QUOTA_DAILY_TOGETHER,
  async complete(args, tier, keyIndex) {
    return callOpenAICompatible(
      { provider: 'together', baseURL: 'https://api.together.xyz/v1' },
      togetherKeys[keyIndex % togetherKeys.length],
      this.modelFor(tier),
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  OpenAI — paid, used only if explicitly preferred or all free providers
 *  are exhausted AND ALLOW_PAID_FALLBACK is on (not yet wired).
 * ============================================================ */

const openaiKey = env.OPENAI_API_KEY;

const openaiProvider: LLMProvider = {
  id: 'openai',
  priority: 30, // low — only when explicitly requested
  isConfigured: () => !!openaiKey,
  keyCount: () => (openaiKey ? 1 : 0),
  modelFor: () => env.OPENAI_MODEL,
  dailyQuotaPerKey: () => 999_999, // effectively unlimited (paid)
  async complete(args, _tier, keyIndex) {
    return callOpenAICompatible(
      { provider: 'openai' },
      openaiKey,
      env.OPENAI_MODEL,
      args,
      keyIndex,
    );
  },
};

/* ============================================================
 *  Ollama — local-only, free, slow, no quota tracking needed.
 * ============================================================ */

async function callOllama(
  model: string,
  args: LLMCallArgs,
  keyIndex: number,
): Promise<LLMCallResult> {
  const started = Date.now();
  const text = await withRetry(
    async () => {
      try {
        const res = await axios.post(
          `${env.OLLAMA_BASE_URL}/api/chat`,
          {
            model,
            messages: [
              {
                role: 'system',
                content: args.jsonMode
                  ? `${args.system}\n\nRespond with a SINGLE valid JSON object only. No prose, no markdown.`
                  : args.system,
              },
              { role: 'user', content: args.user },
            ],
            format: args.jsonMode ? 'json' : undefined,
            stream: false,
            options: { temperature: args.temperature, num_predict: args.maxTokens },
          },
          { timeout: 180_000 },
        );
        const content = res.data?.message?.content;
        if (!content) throw new ExternalApiError('ollama', 'empty completion');
        return content as string;
      } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        throw new ExternalApiError('ollama', message, { retryable: false });
      }
    },
    { label: `ollama:${model}` },
  );
  return { text, provider: 'ollama', model, keyIndex, latencyMs: Date.now() - started };
}

const ollamaProvider: LLMProvider = {
  id: 'ollama',
  priority: 10, // last resort
  isConfigured: () => !!env.OLLAMA_BASE_URL,
  keyCount: () => 1,
  modelFor: () => env.OLLAMA_MODEL,
  dailyQuotaPerKey: () => 999_999,
  async complete(args, _tier, keyIndex) {
    return callOllama(env.OLLAMA_MODEL, args, keyIndex);
  },
};

export const ALL_PROVIDERS: LLMProvider[] = [
  groqProvider,
  cloudflareProvider,
  geminiProvider,
  openrouterProvider,
  huggingfaceProvider,
  togetherProvider,
  openaiProvider,
  ollamaProvider,
];

/** Filter to providers that have keys configured. Sorted by priority desc. */
export function activeProviders(): LLMProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured()).sort(
    (a, b) => b.priority - a.priority,
  );
}

/** Look up a provider by id (or return null). */
export function getProvider(id: string): LLMProvider | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null;
}

export type { LLMProvider, ModelTier, LLMCallArgs, LLMCallResult } from './types';
