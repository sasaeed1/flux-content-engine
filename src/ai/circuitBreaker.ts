/**
 * Circuit breaker — per-provider health + auto-cooldown.
 *
 * The router walks providers by priority; a flaky/down provider would
 * otherwise be retried on every single call, wasting latency and quota. This
 * tracks each provider's recent reliability and trips a breaker after repeated
 * failures so the router skips it during a cooldown, then probes it again.
 *
 * Deliberately IN-MEMORY (not a Supabase table): health is naturally
 * per-process and ephemeral, and the router consults it on every AI call — a
 * DB round-trip there would re-introduce exactly the latency we just removed.
 * Surfaced via /providers for observability.
 *
 * State machine per provider:
 *   closed   (healthy)  → calls flow; failures increment a counter
 *   open     (cooling)  → after N consecutive failures; calls skip it until
 *                         openUntil, with exponential backoff on repeat trips
 *   half-open(probe)    → once openUntil passes, the next call is a trial:
 *                         success → closed, failure → open again (longer)
 */
import { childLogger } from '../lib/logger';

const log = childLogger({ module: 'circuit-breaker' });

const FAILURE_THRESHOLD = 3; // consecutive failures before tripping
const BASE_COOLDOWN_MS = 60_000; // 60s
const MAX_COOLDOWN_MS = 10 * 60_000; // 10m cap

interface Health {
  consecutiveFailures: number;
  /** Epoch ms until which the breaker is open (0 = closed). */
  openUntil: number;
  /** How many times we've tripped without a clean recovery (drives backoff). */
  trips: number;
  totalSuccesses: number;
  totalFailures: number;
  lastError: string | null;
  lastErrorAt: number | null;
  lastSuccessAt: number | null;
}

const state = new Map<string, Health>();

function get(id: string): Health {
  let h = state.get(id);
  if (!h) {
    h = {
      consecutiveFailures: 0,
      openUntil: 0,
      trips: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastError: null,
      lastErrorAt: null,
      lastSuccessAt: null,
    };
    state.set(id, h);
  }
  return h;
}

/** True if the router may attempt this provider right now (closed or half-open). */
export function isAvailable(id: string): boolean {
  const h = state.get(id);
  if (!h) return true;
  return Date.now() >= h.openUntil;
}

export function recordSuccess(id: string): void {
  const h = get(id);
  if (h.openUntil > 0 || h.consecutiveFailures > 0) {
    log.info({ provider: id }, 'circuit recovered → closed');
  }
  h.consecutiveFailures = 0;
  h.openUntil = 0;
  h.trips = 0;
  h.totalSuccesses += 1;
  h.lastSuccessAt = Date.now();
}

export function recordFailure(id: string, errMsg: string): void {
  const h = get(id);
  h.consecutiveFailures += 1;
  h.totalFailures += 1;
  h.lastError = errMsg.slice(0, 200);
  h.lastErrorAt = Date.now();

  if (h.consecutiveFailures >= FAILURE_THRESHOLD) {
    h.trips += 1;
    // Exponential backoff: 60s, 120s, 240s … capped at 10m.
    const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (h.trips - 1), MAX_COOLDOWN_MS);
    h.openUntil = Date.now() + cooldown;
    h.consecutiveFailures = 0; // reset the counter; the breaker is now open
    log.warn(
      { provider: id, cooldownMs: cooldown, trips: h.trips, err: h.lastError },
      'circuit tripped → open (cooling down)',
    );
  }
}

export type BreakerState = 'healthy' | 'degraded' | 'cooling';

export interface ProviderHealth {
  state: BreakerState;
  consecutiveFailures: number;
  cooldownRemainingMs: number;
  totalSuccesses: number;
  totalFailures: number;
  lastError: string | null;
}

export function healthOf(id: string): ProviderHealth {
  const h = state.get(id);
  if (!h) {
    return {
      state: 'healthy',
      consecutiveFailures: 0,
      cooldownRemainingMs: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastError: null,
    };
  }
  const now = Date.now();
  const cooling = h.openUntil > now;
  return {
    state: cooling ? 'cooling' : h.consecutiveFailures > 0 ? 'degraded' : 'healthy',
    consecutiveFailures: h.consecutiveFailures,
    cooldownRemainingMs: cooling ? h.openUntil - now : 0,
    totalSuccesses: h.totalSuccesses,
    totalFailures: h.totalFailures,
    lastError: h.lastError,
  };
}
