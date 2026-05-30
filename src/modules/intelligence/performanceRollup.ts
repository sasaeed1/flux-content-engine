/**
 * Performance rollup — Phase 3D.
 *
 * Joins three layers of data into a single `content_performance` row per
 * carousel, so the personalization loop (`/memory/recall`, hook bias,
 * style bias) actually has real signal to work with.
 *
 *   raw IG metrics (post_analytics)
 *     │
 *     ├─ join on published_posts.ig_media_id
 *     │     ↓
 *     │  carousel/post identity
 *     │     ↓
 *     ├─ join on generated_carousels.metadata
 *     │     → hook_archetype, style_mode_key, cta_style
 *     │     ↓
 *     └─ upsert content_performance (one row per carousel, refreshed each run)
 *
 * The rollup is *idempotent* — running it twice is safe. We compute the
 * engagement_rate as (likes + comments + saves + shares) / max(reach, 1)
 * and clamp to [0, 1]. Reach=0 implies the metric isn't available yet
 * (very new post) — we skip rather than write a bogus 0.
 *
 * Scoped per-org. Used in two places:
 *   1. `collectRecentAnalytics()` calls this for every org after it
 *      refreshes raw analytics.
 *   2. Manual trigger via `POST /api/tenant/intelligence/performance/rollup`.
 */
import { supabase } from '../../lib/supabase';
import { childLogger } from '../../lib/logger';
import { toErrorMessage } from '../../lib/errors';

const log = childLogger({ module: 'performance-rollup' });

export interface RollupResult {
  organizationId: string;
  carouselsConsidered: number;
  rowsWritten: number;
  rowsSkipped: number;
  errors: number;
}

/** Latest analytics snapshot per published post, in the lookback window. */
interface AnalyticsSnapshot {
  organization_id: string;
  published_post_id: string;
  ig_media_id: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  recorded_at: string;
}

interface PublishedPost {
  id: string;
  organization_id: string;
  carousel_id: string | null;
  post_id: string | null;
  published_at: string | null;
}

interface CarouselMetadata {
  id: string;
  organization_id: string;
  slide_count: number | null;
  metadata: Record<string, unknown> | null;
  brand_profile_id: string | null;
}

function safeNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function computeEngagementRate(snap: AnalyticsSnapshot): number {
  const interactions =
    safeNum(snap.likes) +
    safeNum(snap.comments) +
    safeNum(snap.saves) +
    safeNum(snap.shares);
  const reach = safeNum(snap.reach);
  if (reach <= 0) return 0;
  const rate = interactions / reach;
  return Math.max(0, Math.min(1, Number(rate.toFixed(4))));
}

/**
 * Pull the most-recent analytics row per published post within the window.
 * Returns a map keyed by published_post_id.
 */
async function fetchLatestAnalytics(
  orgId: string,
  sinceHours: number,
): Promise<Map<string, AnalyticsSnapshot>> {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('post_analytics')
    .select(
      'organization_id, published_post_id, ig_media_id, views, reach, likes, comments, shares, saves, recorded_at',
    )
    .eq('organization_id', orgId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`fetchLatestAnalytics: ${error.message}`);

  const out = new Map<string, AnalyticsSnapshot>();
  for (const row of (data ?? []) as AnalyticsSnapshot[]) {
    // First (most recent) wins thanks to the ordering.
    if (!out.has(row.published_post_id)) out.set(row.published_post_id, row);
  }
  return out;
}

async function fetchPublishedPosts(
  orgId: string,
  publishedPostIds: string[],
): Promise<Map<string, PublishedPost>> {
  if (publishedPostIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('published_posts')
    .select('id, organization_id, carousel_id, post_id, published_at')
    .eq('organization_id', orgId)
    .in('id', publishedPostIds);
  if (error) throw new Error(`fetchPublishedPosts: ${error.message}`);
  const out = new Map<string, PublishedPost>();
  for (const p of (data ?? []) as PublishedPost[]) out.set(p.id, p);
  return out;
}

async function fetchCarousels(
  orgId: string,
  carouselIds: string[],
): Promise<Map<string, CarouselMetadata>> {
  if (carouselIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('generated_carousels')
    .select('id, organization_id, slide_count, metadata, brand_profile_id')
    .eq('organization_id', orgId)
    .in('id', carouselIds);
  if (error) throw new Error(`fetchCarousels: ${error.message}`);
  const out = new Map<string, CarouselMetadata>();
  for (const c of (data ?? []) as CarouselMetadata[]) out.set(c.id, c);
  return out;
}

/** Brand defaults — used when carousel metadata doesn't carry cta_style. */
async function fetchBrandCtaStyles(
  orgId: string,
  brandIds: string[],
): Promise<Map<string, string | null>> {
  if (brandIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('brand_profiles')
    .select('id, cta_style')
    .eq('organization_id', orgId)
    .in('id', brandIds);
  if (error) throw new Error(`fetchBrandCtaStyles: ${error.message}`);
  const out = new Map<string, string | null>();
  for (const b of (data ?? []) as Array<{ id: string; cta_style: string | null }>) {
    out.set(b.id, b.cta_style ?? null);
  }
  return out;
}

/**
 * Run the rollup for a single org. Window defaults to 30 days so newly-
 * synced metrics for older posts still update their row.
 */
export async function rollupOrganizationPerformance(
  orgId: string,
  sinceHours = 30 * 24,
): Promise<RollupResult> {
  const t0 = Date.now();
  const result: RollupResult = {
    organizationId: orgId,
    carouselsConsidered: 0,
    rowsWritten: 0,
    rowsSkipped: 0,
    errors: 0,
  };

  try {
    // 1. Get the latest analytics snapshot per published post.
    const snaps = await fetchLatestAnalytics(orgId, sinceHours);
    if (snaps.size === 0) {
      log.info({ orgId, ms: Date.now() - t0 }, 'No recent analytics — nothing to roll up');
      return result;
    }

    // 2. Pull the published_posts those snapshots belong to.
    const pubPosts = await fetchPublishedPosts(orgId, [...snaps.keys()]);

    // 3. Pull the carousels behind those published_posts.
    const carouselIds = [...pubPosts.values()]
      .map((p) => p.carousel_id)
      .filter((v): v is string => !!v);
    const carousels = await fetchCarousels(orgId, carouselIds);
    result.carouselsConsidered = carousels.size;

    // 4. For carousels missing cta_style in metadata, fall back to brand default.
    const brandIds = [...carousels.values()]
      .map((c) => c.brand_profile_id)
      .filter((v): v is string => !!v);
    const brandCtas = await fetchBrandCtaStyles(orgId, [...new Set(brandIds)]);

    // 5. Walk each carousel and upsert a content_performance row.
    for (const carousel of carousels.values()) {
      // Find the published_post → snap chain for this carousel.
      const pub = [...pubPosts.values()].find((p) => p.carousel_id === carousel.id);
      if (!pub) {
        result.rowsSkipped++;
        continue;
      }
      const snap = snaps.get(pub.id);
      if (!snap) {
        result.rowsSkipped++;
        continue;
      }

      const md = (carousel.metadata ?? {}) as Record<string, unknown>;
      const hookArchetype = (md.hook_archetype as string | null) ?? null;
      const styleModeKey = (md.style_mode_key as string | null) ?? null;
      // Prefer the snapshot-time cta_style we wrote in pipeline, else use
      // the brand's current default.
      const ctaStyle =
        (md.cta_style as string | null) ??
        (carousel.brand_profile_id ? brandCtas.get(carousel.brand_profile_id) ?? null : null);

      // Skip rows where we have no signal AND no metrics worth recording —
      // they pollute the rollup without driving any future decision.
      const hasAnySignal = !!hookArchetype || !!styleModeKey || !!ctaStyle;
      const hasAnyMetric =
        safeNum(snap.reach) > 0 ||
        safeNum(snap.likes) > 0 ||
        safeNum(snap.comments) > 0;
      if (!hasAnySignal && !hasAnyMetric) {
        result.rowsSkipped++;
        continue;
      }

      const rate = computeEngagementRate(snap);

      // Idempotent upsert keyed by carousel_id — one row per carousel,
      // refreshed each sync. We delete-then-insert because content_performance
      // doesn't have a UNIQUE constraint on carousel_id and Supabase upsert
      // requires one. Cheaper than chasing a migration here.
      await supabase
        .from('content_performance')
        .delete()
        .eq('organization_id', orgId)
        .eq('carousel_id', carousel.id);

      const { error: insErr } = await supabase.from('content_performance').insert({
        organization_id: orgId,
        carousel_id: carousel.id,
        post_id: null,
        hook_archetype: hookArchetype,
        style_mode_key: styleModeKey,
        cta_style: ctaStyle,
        slide_count: carousel.slide_count ?? null,
        views: safeNum(snap.views),
        likes: safeNum(snap.likes),
        comments: safeNum(snap.comments),
        saves: safeNum(snap.saves),
        reach: safeNum(snap.reach),
        engagement_rate: rate,
        recorded_at: new Date().toISOString(),
      });
      if (insErr) {
        log.warn(
          { orgId, carouselId: carousel.id, err: insErr.message },
          'content_performance insert failed',
        );
        result.errors++;
        continue;
      }
      result.rowsWritten++;
    }
  } catch (err) {
    log.error(
      { orgId, error: toErrorMessage(err) },
      'rollupOrganizationPerformance failed',
    );
    result.errors++;
  }

  log.info(
    {
      orgId,
      considered: result.carouselsConsidered,
      written: result.rowsWritten,
      skipped: result.rowsSkipped,
      errors: result.errors,
      ms: Date.now() - t0,
    },
    'Performance rollup complete',
  );
  return result;
}

/**
 * Roll up performance for every org that has had analytics activity in the
 * window. Called by the scheduler right after `collectRecentAnalytics`.
 */
export async function rollupAllPerformance(sinceHours = 96): Promise<{
  orgsProcessed: number;
  totalWritten: number;
}> {
  // Find orgs with recent analytics activity — narrow the work to whoever
  // could possibly have new data.
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data, error } = await supabase
    .from('post_analytics')
    .select('organization_id')
    .gte('recorded_at', since);
  if (error) throw new Error(`rollupAllPerformance: ${error.message}`);

  const orgIds = [...new Set((data ?? []).map((r) => r.organization_id as string))];
  let totalWritten = 0;
  for (const orgId of orgIds) {
    const r = await rollupOrganizationPerformance(orgId, Math.max(sinceHours, 30 * 24));
    totalWritten += r.rowsWritten;
  }
  return { orgsProcessed: orgIds.length, totalWritten };
}

/**
 * Top-N performers grouped by (hook | style | cta). Used by:
 *   - the hook archetype bias (pickNextHookArchetype reads weights from here)
 *   - the Studio "top performing styles" recommendation card
 *   - `/api/tenant/intelligence/performance/top` for the UI
 */
export interface PerformanceWeights {
  byHook: Map<string, { sample: number; avgEngagement: number }>;
  byStyle: Map<string, { sample: number; avgEngagement: number }>;
  byCta: Map<string, { sample: number; avgEngagement: number }>;
  sampleSize: number;
}

const EMPTY_WEIGHTS: PerformanceWeights = {
  byHook: new Map(),
  byStyle: new Map(),
  byCta: new Map(),
  sampleSize: 0,
};

/**
 * Load the personalization weights for an org. Returns empty maps if the org
 * has no rollup data yet — the caller treats absence as "no signal, fall back
 * to anti-repetition rotation."
 *
 * `minSamples` enforces a floor: a single carousel that did 0.4 engagement is
 * not enough signal to bias against the others. Default 2.
 */
export async function loadPerformanceWeights(
  orgId: string,
  opts: { minSamples?: number; limit?: number } = {},
): Promise<PerformanceWeights> {
  const minSamples = Math.max(1, opts.minSamples ?? 2);
  const limit = Math.max(20, opts.limit ?? 200);

  const { data, error } = await supabase
    .from('content_performance')
    .select('hook_archetype, style_mode_key, cta_style, engagement_rate, recorded_at')
    .eq('organization_id', orgId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error) {
    log.warn({ orgId, err: error.message }, 'loadPerformanceWeights failed — falling back to empty');
    return EMPTY_WEIGHTS;
  }
  const rows = data ?? [];
  if (rows.length === 0) return EMPTY_WEIGHTS;

  const collect = (key: 'hook_archetype' | 'style_mode_key' | 'cta_style') => {
    const m = new Map<string, { sample: number; avgEngagement: number }>();
    for (const r of rows) {
      const k = (r as Record<string, unknown>)[key] as string | null;
      if (!k) continue;
      const rate = safeNum((r as { engagement_rate: number | null }).engagement_rate);
      const existing = m.get(k) ?? { sample: 0, avgEngagement: 0 };
      m.set(k, {
        sample: existing.sample + 1,
        avgEngagement:
          (existing.avgEngagement * existing.sample + rate) / (existing.sample + 1),
      });
    }
    // Drop keys below the sample floor.
    for (const [k, v] of m) if (v.sample < minSamples) m.delete(k);
    return m;
  };

  return {
    byHook: collect('hook_archetype'),
    byStyle: collect('style_mode_key'),
    byCta: collect('cta_style'),
    sampleSize: rows.length,
  };
}
