/**
 * Shared OpenAI-compatible chat-completion path used by:
 *   - Groq      (baseURL: https://api.groq.com/openai/v1)
 *   - OpenRouter (baseURL: https://openrouter.ai/api/v1)
 *   - Together   (baseURL: https://api.together.xyz/v1)
 *   - OpenAI     (default openai.com endpoint)
 *
 * Free-tier-friendly: each provider supplies their own key list; we round-
 * robin via the keyIndex passed in by the router.
 */
import OpenAI from 'openai';
import { ExternalApiError } from '../../lib/errors';
import { withRetry } from '../../lib/retry';
import type { LLMCallArgs, LLMCallResult, ProviderId } from './types';

interface BuildArgs {
  provider: ProviderId;
  baseURL?: string;
  /** Extra HTTP headers (OpenRouter wants HTTP-Referer + X-Title). */
  defaultHeaders?: Record<string, string>;
}

const _clients = new Map<string, OpenAI>();

function clientFor(opts: BuildArgs, apiKey: string): OpenAI {
  const cacheKey = `${opts.provider}::${apiKey.slice(0, 8)}`;
  let c = _clients.get(cacheKey);
  if (!c) {
    c = new OpenAI({
      apiKey,
      baseURL: opts.baseURL,
      defaultHeaders: opts.defaultHeaders,
    });
    _clients.set(cacheKey, c);
  }
  return c;
}

export async function callOpenAICompatible(
  opts: BuildArgs,
  apiKey: string,
  model: string,
  args: LLMCallArgs,
  keyIndex: number,
): Promise<LLMCallResult> {
  const client = clientFor(opts, apiKey);
  const started = Date.now();
  // Groq requires the word "json" to appear in the prompt when using
  // response_format: json_object. OpenAI tolerates it but doesn't require it.
  // Cheap, universally-safe fix: append a one-liner reminder when jsonMode.
  const system = args.jsonMode
    ? `${args.system}\n\nRespond as a SINGLE valid JSON object. No prose, no markdown.`
    : args.system;
  const result = await withRetry(
    async () => {
      try {
        const res = await client.chat.completions.create({
          model,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          response_format: args.jsonMode ? { type: 'json_object' } : undefined,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: args.user },
          ],
        });
        const content = res.choices[0]?.message?.content;
        if (!content) throw new ExternalApiError(opts.provider, 'empty completion');
        // Sprint A — capture usage when the provider returns it. Falls back
        // to a character-based estimate further down if usage is missing.
        const usage = (res as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage;
        const approxTokens =
          typeof usage?.total_tokens === 'number'
            ? usage.total_tokens
            : typeof usage?.prompt_tokens === 'number' || typeof usage?.completion_tokens === 'number'
              ? (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)
              : undefined;
        return { content, approxTokens };
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const message = (err as Error)?.message ?? String(err);
        const retryable = status === undefined || status === 429 || status >= 500;
        throw new ExternalApiError(opts.provider, message, {
          status: status ?? 502,
          retryable,
        });
      }
    },
    { label: `${opts.provider}:${model}` },
  );

  // Sprint A — fall back to a chars/4 estimate when the provider omits usage.
  const approxTokens =
    result.approxTokens ??
    Math.ceil((system.length + args.user.length + result.content.length) / 4);

  return {
    text: result.content,
    provider: opts.provider,
    model,
    keyIndex,
    latencyMs: Date.now() - started,
    approxTokens,
  };
}
