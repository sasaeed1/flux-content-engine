/**
 * Deterministic response cache for LLM calls.
 *
 *   key = sha256(provider:model:system:user:temperature)
 *   value = raw text response
 *
 * Hit/miss tracked. TTL enforced at read time. Backed by `ai_response_cache`
 * table in Supabase (cheap, free-tier friendly — no Redis needed).
 *
 * The cache is opt-in per call. Generation flows that benefit most:
 *   - Topic generation with same brand + theme hint
 *   - Hook batch generation
 *   - Slide rewrites with same style + slot content
 *
 * Flows that should NOT cache:
 *   - Anything with timestamps or random elements in the prompt
 *   - User-initiated regenerations (they expect different output)
 */
import crypto from 'node:crypto';
import { env } from '../config/env';
import { supabase } from '../lib/supabase';
import { childLogger } from '../lib/logger';

const log = childLogger({ module: 'ai-cache' });

export interface CacheKeyInput {
  provider: string;
  model: string;
  system: string;
  user: string;
  temperature: number;
}

export function cacheKey(input: CacheKeyInput): string {
  const h = crypto.createHash('sha256');
  h.update(input.provider);
  h.update('\x00');
  h.update(input.model);
  h.update('\x00');
  h.update(input.system);
  h.update('\x00');
  h.update(input.user);
  h.update('\x00');
  h.update(input.temperature.toFixed(3));
  return h.digest('hex');
}

export async function lookup(key: string): Promise<string | null> {
  if (!env.ENABLE_RESPONSE_CACHE) return null;
  try {
    const { data, error } = await supabase
      .from('ai_response_cache')
      .select('response_text, expires_at')
      .eq('cache_key', key)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    // Fire-and-forget hit counter increment.
    void supabase
      .rpc('increment_cache_hit', { p_key: key })
      .then(() => undefined, () => undefined);
    return data.response_text as string;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'cache lookup failed (non-fatal)');
    return null;
  }
}

export async function store(
  key: string,
  provider: string,
  model: string,
  responseText: string,
): Promise<void> {
  if (!env.ENABLE_RESPONSE_CACHE) return;
  try {
    const expiresAt = new Date(Date.now() + env.CACHE_TTL_SECONDS * 1000).toISOString();
    await supabase.from('ai_response_cache').upsert(
      {
        cache_key: key,
        provider,
        model,
        response_text: responseText,
        bytes: Buffer.byteLength(responseText, 'utf8'),
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' },
    );
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'cache store failed (non-fatal)');
  }
}

/**
 * Purge expired entries. Called periodically by a maintenance job.
 * Safe to no-op on failure.
 */
export async function purgeExpired(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('ai_response_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('cache_key');
    if (error) {
      log.warn({ err: error.message }, 'cache purge failed');
      return 0;
    }
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}
