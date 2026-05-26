/**
 * LLM abstraction — Groq / OpenAI / Ollama, with per-tenant override.
 *
 * Groq + OpenAI share the OpenAI-compatible chat API (Groq just points the
 * OpenAI SDK at a different baseURL). Ollama is plain HTTP JSON.
 *
 * Tenancy:
 *   - The default provider + model come from env.
 *   - A tenant can override `aiProvider` and `aiProviderKey` on its
 *     organization row; pass them via the `ctx` argument to `completeJson`.
 */
import OpenAI from 'openai';
import axios from 'axios';
import { z } from 'zod';
import { env, requireEnv } from '../config/env';
import { AppError, ExternalApiError, ValidationError } from '../lib/errors';
import { describeAxiosError } from '../lib/http';
import { withRetry } from '../lib/retry';
import type { LlmProvider } from '../types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/* ============================================================
 *  Clients
 * ============================================================ */

let _envOpenAI: OpenAI | null = null;
function envOpenAIClient(): OpenAI {
  if (!_envOpenAI) {
    _envOpenAI = new OpenAI({
      apiKey: requireEnv('OPENAI_API_KEY', 'required when AI_PROVIDER=openai (or as a tenant override)'),
    });
  }
  return _envOpenAI;
}

let _envGroq: OpenAI | null = null;
function envGroqClient(): OpenAI {
  if (!_envGroq) {
    _envGroq = new OpenAI({
      apiKey: requireEnv('GROQ_API_KEY', 'required when AI_PROVIDER=groq'),
      baseURL: GROQ_BASE_URL,
    });
  }
  return _envGroq;
}

function tenantOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function tenantGroqClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
}

/* ============================================================
 *  Error wrapping (OpenAI/Groq SDK -> AppError so withRetry can retry)
 * ============================================================ */

function wrapProviderError(provider: string, err: unknown): never {
  if (err instanceof AppError) throw err;
  const status = (err as { status?: number })?.status;
  const message = (err as Error)?.message ?? String(err);
  const retryable = status === undefined || status === 429 || status >= 500;
  throw new ExternalApiError(provider, message, { status: status ?? 502, retryable });
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/* ============================================================
 *  Per-provider calls
 * ============================================================ */

interface CallArgs {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}

async function callChatCompletions(
  client: OpenAI,
  model: string,
  provider: string,
  args: CallArgs,
): Promise<string> {
  return withRetry(
    async () => {
      try {
        const res = await client.chat.completions.create({
          model,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: args.system },
            { role: 'user', content: args.user },
          ],
        });
        const content = res.choices[0]?.message?.content;
        if (!content) throw new ExternalApiError(provider, 'empty completion');
        return content;
      } catch (err) {
        wrapProviderError(provider, err);
      }
    },
    { label: `${provider}:${model}` },
  );
}

async function callOllama(model: string, baseUrl: string, args: CallArgs): Promise<string> {
  const text = await withRetry(
    async () => {
      const res = await axios.post(
        `${baseUrl}/api/chat`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: `${args.system}\n\nRespond with a SINGLE valid JSON object only. No prose, no markdown.`,
            },
            { role: 'user', content: args.user },
          ],
          format: 'json',
          stream: false,
          options: {
            temperature: args.temperature,
            num_predict: args.maxTokens,
          },
        },
        { timeout: 180_000 },
      );
      const content = (res.data?.message?.content ?? '') as string;
      if (!content) throw new ExternalApiError('ollama', 'empty completion');
      return content;
    },
    { label: `ollama:${model}` },
  ).catch((err) => {
    throw new ExternalApiError('ollama', describeAxiosError(err), { retryable: false });
  });

  return text;
}

/* ============================================================
 *  Public API
 * ============================================================ */

export interface LlmCallContext {
  /** Per-tenant override of the configured provider. */
  provider?: LlmProvider | null;
  /** Per-tenant API key (only used with the override provider). */
  apiKey?: string | null;
  /** Optional override of the model (otherwise env default for the provider). */
  model?: string | null;
}

interface CompleteJsonArgs<S extends z.ZodTypeAny> {
  system: string;
  user: string;
  schema: S;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Call the configured LLM and return parsed, schema-validated JSON.
 * Pass `ctx` to apply a per-tenant provider/key override.
 */
export async function completeJson<S extends z.ZodTypeAny>(
  args: CompleteJsonArgs<S>,
  ctx: LlmCallContext = {},
): Promise<z.infer<S>> {
  const provider: LlmProvider = (ctx.provider ?? env.AI_PROVIDER) as LlmProvider;
  const temperature = args.temperature ?? 0.8;
  const maxTokens = args.maxTokens ?? 2600;
  const callArgs: CallArgs = {
    system: args.system,
    user: args.user,
    temperature,
    maxTokens,
  };

  let raw: string;
  if (provider === 'ollama') {
    const model = ctx.model ?? env.OLLAMA_MODEL;
    raw = await callOllama(model, env.OLLAMA_BASE_URL, callArgs);
  } else if (provider === 'openai') {
    const model = ctx.model ?? env.OPENAI_MODEL;
    const client = ctx.apiKey ? tenantOpenAIClient(ctx.apiKey) : envOpenAIClient();
    raw = await callChatCompletions(client, model, 'openai', callArgs);
  } else {
    const model = ctx.model ?? env.GROQ_MODEL;
    const client = ctx.apiKey ? tenantGroqClient(ctx.apiKey) : envGroqClient();
    raw = await callChatCompletions(client, model, 'groq', callArgs);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (err) {
    throw new ValidationError(`LLM returned non-JSON output: ${(err as Error).message}`, {
      context: { rawPreview: raw.slice(0, 600) },
    });
  }

  const result = args.schema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new ValidationError(`LLM JSON failed validation: ${detail}`, {
      context: { rawPreview: raw.slice(0, 600) },
    });
  }
  return result.data;
}
