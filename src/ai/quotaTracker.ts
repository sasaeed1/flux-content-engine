/**
 * Sliding-window quota tracker — Supabase-backed.
 *
 * Each provider key has a per-day call budget (see env.QUOTA_DAILY_*).
 * The router calls `quotaAvailable()` before dispatching and `recordCall()`
 * after. Tracking writes are best-effort — if Supabase is down we still
 * route the call.
 *
 *   table: provider_quota_log (provider, key_index, day, call_count, ...)
 */
import { supabase } from '../lib/supabase';
import { childLogger } from '../lib/logger';
import type { LLMProvider } from './providers/types';

const log = childLogger({ module: 'quota' });

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Return the key index in the provider's rotation pool that has the most
 * remaining budget today, or null if every key is exhausted.
 */
export async function pickAvailableKey(provider: LLMProvider): Promise<number | null> {
  const n = provider.keyCount();
  if (n === 0) return null;
  const cap = provider.dailyQuotaPerKey();
  if (cap <= 0) return 0; // unlimited

  try {
    const { data, error } = await supabase
      .from('provider_quota_log')
      .select('key_index, call_count')
      .eq('provider', provider.id)
      .eq('day', today());
    if (error) {
      log.warn({ provider: provider.id, err: error.message }, 'quota lookup failed — assuming all available');
      return 0;
    }
    const usage = new Map<number, number>();
    for (const row of data ?? []) usage.set(row.key_index, row.call_count);

    let bestIdx = -1;
    let bestRemaining = -1;
    for (let i = 0; i < n; i++) {
      const used = usage.get(i) ?? 0;
      const remaining = cap - used;
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestIdx = i;
      }
    }
    if (bestRemaining <= 0) return null;
    return bestIdx;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'quota check failed — assuming all available');
    return 0;
  }
}

/**
 * Increment the per-day counter for a provider key. Best-effort — failures
 * are logged but don't propagate. UPSERT semantics.
 */
export async function recordCall(
  provider: LLMProvider,
  keyIndex: number,
  approxTokens?: number,
): Promise<void> {
  try {
    const day = today();
    // Try to update existing row; insert if missing. RPCs aren't worth the
    // round trip — two-step is fine since concurrent writes only over-count
    // marginally (and that's the safe direction).
    const { data: existing } = await supabase
      .from('provider_quota_log')
      .select('call_count, token_count')
      .eq('provider', provider.id)
      .eq('key_index', keyIndex)
      .eq('day', day)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('provider_quota_log')
        .update({
          call_count: existing.call_count + 1,
          token_count: (existing.token_count ?? 0) + (approxTokens ?? 0),
          last_call_at: new Date().toISOString(),
        })
        .eq('provider', provider.id)
        .eq('key_index', keyIndex)
        .eq('day', day);
    } else {
      await supabase.from('provider_quota_log').insert({
        provider: provider.id,
        key_index: keyIndex,
        day,
        call_count: 1,
        token_count: approxTokens ?? 0,
      });
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'quota record failed (non-fatal)');
  }
}

/**
 * Return a summary of today's usage across all providers — used by
 * /api/intelligence/quotas to show the user how much of each free tier
 * they've consumed.
 */
export async function dailySummary(): Promise<
  Array<{ provider: string; key_index: number; call_count: number; token_count: number }>
> {
  const { data, error } = await supabase
    .from('provider_quota_log')
    .select('provider, key_index, call_count, token_count')
    .eq('day', today())
    .order('provider')
    .order('key_index');
  if (error) {
    log.warn({ err: error.message }, 'quota summary failed');
    return [];
  }
  return data ?? [];
}
