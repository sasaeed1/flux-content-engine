/**
 * microCache — a tiny in-process TTL cache for hot read endpoints.
 *
 * Supabase free-tier view/aggregate reads run ~1s each, so repeated dashboard/
 * home/forge navigations feel sluggish. These endpoints are pure per-org reads
 * with low write frequency — a short in-memory cache keyed by orgId makes warm
 * navigations near-instant with no cross-tenant risk (every key includes the
 * org id).
 *
 * Deliberately process-local (not Redis): a single engine container, and a few
 * seconds of staleness on a stats/insights read is invisible to users. Mutation
 * endpoints bust the relevant keys explicitly.
 */
interface Entry {
  exp: number;
  val: unknown;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 5000;

/** Return the cached value if present and unexpired, else null. */
export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) {
    store.delete(key);
    return null;
  }
  return e.val as T;
}

/** Store a value with a TTL in milliseconds. */
export function cacheSet(key: string, val: unknown, ttlMs: number): void {
  // Cheap eviction: drop the oldest inserted key when over the cap.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { exp: Date.now() + ttlMs, val });
}

/** Invalidate one key, or all keys beginning with `prefix` when it ends in ':'. */
export function cacheBust(keyOrPrefix: string): void {
  if (keyOrPrefix.endsWith(':')) {
    for (const k of store.keys()) {
      if (k.startsWith(keyOrPrefix)) store.delete(k);
    }
  } else {
    store.delete(keyOrPrefix);
  }
}
