/**
 * AI Router — picks the best free-tier provider per request, with failover.
 *
 *   1. Read tier (fast / balanced / reasoning / utility) from the caller.
 *   2. Walk providers in priority order. For each, ask quotaTracker for an
 *      available key. First match wins.
 *   3. Call provider.complete(). On retryable failure, fall through to the
 *      next provider. Non-retryable failures bubble up.
 *   4. Record the call against the chosen provider's quota counter.
 *
 * The router is invoked by `completeJsonRouted()` below — a drop-in
 * upgrade of the legacy `completeJson` in src/ai/llm.ts.
 */
import { z } from 'zod';
import { env } from '../config/env';
import { childLogger } from '../lib/logger';
import { ExternalApiError, ValidationError } from '../lib/errors';
import { activeProviders, getProvider } from './providers';
import type {
  LLMCallArgs,
  LLMCallResult,
  LLMProvider,
  ModelTier,
} from './providers/types';
import { pickAvailableKey, recordCall } from './quotaTracker';
import { cacheKey, lookup as cacheLookup, store as cacheStore } from './cache';
import {
  healthOf,
  isAvailable,
  recordFailure,
  recordSuccess,
} from './circuitBreaker';

const log = childLogger({ module: 'ai-router' });

export interface RoutedCallContext {
  /** Pin to a specific provider id (skips routing). Use sparingly. */
  preferProvider?: string | null;
  /** Tenant-scoped override (legacy). */
  tenantOverride?: {
    provider: string;
    apiKey: string;
    model?: string;
  } | null;
  /**
   * Force the deterministic response cache ON regardless of temperature.
   * Leave undefined to use the default policy (cache when temperature is at or
   * below CACHE_MAX_TEMPERATURE). Set false together with cacheBypass to never
   * cache.
   */
  cacheEnabled?: boolean;
  /** Force the cache OFF for this call (creative variety). Wins over cacheEnabled. */
  cacheBypass?: boolean;
  /** Tier maps to a model family inside each provider. */
  tier?: ModelTier;
}

/**
 * Cache policy (Sprint A): default-ON for deterministic calls.
 *   - cacheBypass=true            → never cache
 *   - cacheEnabled=true           → always cache
 *   - otherwise                   → cache iff temperature ≤ CACHE_MAX_TEMPERATURE
 * Always gated by the global ENABLE_RESPONSE_CACHE kill switch.
 */
function shouldCache(ctx: RoutedCallContext, temperature: number): boolean {
  if (!env.ENABLE_RESPONSE_CACHE) return false;
  if (ctx.cacheBypass) return false;
  if (ctx.cacheEnabled === true) return true;
  if (ctx.cacheEnabled === false) return false;
  return temperature <= env.CACHE_MAX_TEMPERATURE;
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Internal: route a single text-in / text-out call through the provider plane.
 */
async function routeTextCall(
  args: LLMCallArgs,
  ctx: RoutedCallContext,
): Promise<LLMCallResult> {
  const tier: ModelTier = ctx.tier ?? 'balanced';

  // 1. Cache lookup if enabled. Cache key is provider-agnostic at this layer —
  //    we'll re-hash inside each provider attempt using their actual model.
  //    Sprint A: default-on for deterministic (low-temp) calls.
  let cacheKeyStr: string | null = null;
  if (shouldCache(ctx, args.temperature)) {
    // Use the highest-priority active provider's model for the cache key so
    // multiple providers can share cached entries when they produce
    // structurally-equivalent JSON.
    const top = activeProviders()[0];
    if (top) {
      cacheKeyStr = cacheKey({
        provider: top.id,
        model: top.modelFor(tier),
        system: args.system,
        user: args.user,
        temperature: args.temperature,
      });
      const cached = await cacheLookup(cacheKeyStr);
      if (cached) {
        log.info({ provider: 'cache', tier }, 'cache hit');
        return {
          text: cached,
          provider: top.id,
          model: top.modelFor(tier),
          keyIndex: -1,
          latencyMs: 0,
        };
      }
    }
  }

  // 2. Build the candidate provider list.
  //    Free-tier first: paid providers (OpenAI) are excluded unless
  //    ALLOW_PAID_FALLBACK is on (then appended LAST, after the whole free
  //    pool), or the caller explicitly pins one via preferProvider.
  let providers: LLMProvider[];
  if (ctx.preferProvider) {
    const p = getProvider(ctx.preferProvider);
    providers = p && p.isConfigured() ? [p] : [];
  } else {
    const active = activeProviders();
    const free = active.filter((p) => !p.isPaid);
    const paid = active.filter((p) => p.isPaid);
    if (free.length === 0) {
      // Only paid providers are configured — use them rather than fail.
      providers = paid;
    } else if (env.ALLOW_PAID_FALLBACK) {
      providers = [...free, ...paid]; // paid as last resort
    } else {
      providers = free;
    }
  }
  if (providers.length === 0) {
    throw new ExternalApiError(
      'router',
      'No AI provider is configured. Add at least one API key to the engine .env (GROQ_API_KEY, GEMINI_API_KEYS, OPENROUTER_API_KEYS, etc.).',
    );
  }

  // 3. Walk providers with failover + circuit breaker.
  const errors: string[] = [];
  for (const provider of providers) {
    // Skip a provider whose breaker is open (cooling down after failures).
    if (!isAvailable(provider.id)) {
      errors.push(`${provider.id}: cooling down (circuit open)`);
      continue;
    }
    const keyIndex = await pickAvailableKey(provider);
    if (keyIndex === null) {
      errors.push(`${provider.id}: all keys at daily quota`);
      continue;
    }
    try {
      const result = await provider.complete(args, tier, keyIndex);
      recordSuccess(provider.id);
      // Fire-and-forget quota record + cache store.
      void recordCall(provider, keyIndex, result.approxTokens);
      if (cacheKeyStr) void cacheStore(cacheKeyStr, provider.id, result.model, result.text);
      log.info(
        { provider: provider.id, model: result.model, ms: result.latencyMs, tier },
        'AI call succeeded',
      );
      return result;
    } catch (err) {
      const msg = (err as Error).message || String(err);
      errors.push(`${provider.id}: ${msg}`);
      log.warn({ provider: provider.id, err: msg }, 'provider failed, trying next');
      // Non-retryable validation errors short-circuit and do NOT count against
      // provider health (the prompt is bad, not the provider). Retryable
      // failures trip the breaker.
      if (err instanceof ValidationError) throw err;
      recordFailure(provider.id, msg);
    }
  }

  throw new ExternalApiError(
    'router',
    `All providers failed: ${errors.join(' | ')}`,
    { retryable: true },
  );
}

export interface CompleteJsonRoutedArgs<S extends z.ZodTypeAny> {
  system: string;
  user: string;
  schema: S;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Drop-in replacement for the legacy completeJson() that adds:
 *   - free-tier provider failover
 *   - quota-aware key picking
 *   - deterministic response cache
 *   - tier-based model selection
 *
 * Existing callers can migrate by importing { completeJsonRouted } from
 * '../ai/router'. The legacy completeJson() still works (it now delegates
 * here when no tenant override is set).
 */
export async function completeJsonRouted<S extends z.ZodTypeAny>(
  args: CompleteJsonRoutedArgs<S>,
  ctx: RoutedCallContext = {},
): Promise<z.infer<S>> {
  const temperature = args.temperature ?? 0.8;
  const maxTokens = args.maxTokens ?? 2600;

  const result = await routeTextCall(
    {
      system: args.system,
      user: args.user,
      temperature,
      maxTokens,
      jsonMode: true,
    },
    ctx,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(result.text));
  } catch (err) {
    throw new ValidationError(`LLM returned non-JSON output: ${(err as Error).message}`, {
      context: { rawPreview: result.text.slice(0, 600), provider: result.provider },
    });
  }
  const v = args.schema.safeParse(parsed);
  if (!v.success) {
    const detail = v.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new ValidationError(`LLM JSON failed validation: ${detail}`, {
      context: { rawPreview: result.text.slice(0, 600), provider: result.provider },
    });
  }
  return v.data;
}

/**
 * Public observability helpers — used by the new /api/intelligence/providers
 * endpoint to show which free-tier providers are configured + their state.
 */
export function providerStatus(): Array<{
  id: string;
  priority: number;
  configured: boolean;
  keyCount: number;
  dailyQuotaPerKey: number;
  isPaid: boolean;
  costPer1MTokens: number;
  costTier: 'free' | 'low' | 'standard';
  health: ReturnType<typeof healthOf>;
}> {
  return [...new Set(activeProviders().map((p) => p.id))]
    .map((id) => getProvider(id)!)
    .map((p) => ({
      id: p.id,
      priority: p.priority,
      configured: p.isConfigured(),
      keyCount: p.keyCount(),
      dailyQuotaPerKey: p.dailyQuotaPerKey(),
      isPaid: p.isPaid,
      costPer1MTokens: p.costPer1MTokens,
      costTier: p.costPer1MTokens === 0 ? 'free' : p.costPer1MTokens < 50 ? 'low' : 'standard',
      health: healthOf(p.id),
    }));
}
