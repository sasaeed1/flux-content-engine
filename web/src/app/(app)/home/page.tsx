import { BriefBar } from '@/components/home/brief-bar';
import { TelemetryStrip } from '@/components/home/telemetry-strip';
import { OpportunityFeed } from '@/components/home/opportunity-feed';
import { ContinueCreating, type ResumableCarousel } from '@/components/home/continue-creating';
import { TrendingSparks } from '@/components/home/trending-sparks';
import { PulseLog, type SeedEntry } from '@/components/home/pulse-log';
import { api } from '@/lib/api-client';
import { fmtRelative } from '@/lib/format';
import type { InsightCard } from '@/components/flux/presence-card';
import type { CarouselRow, OrgOverview, PipelineRun } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

/** Build the one-sentence AI brief from the workspace state. */
function buildSynthesis(o: OrgOverview | null, topTrend?: string): string {
  if (!o) return 'Connecting to your engine… your daily brief will appear here in a moment.';
  const parts: string[] = [];
  if (o.ready_carousels > 0)
    parts.push(`${o.ready_carousels} carousel${o.ready_carousels === 1 ? ' is' : 's are'} ready to ship`);
  if (o.pending_topics > 0)
    parts.push(`${o.pending_topics} idea${o.pending_topics === 1 ? '' : 's'} queued`);
  if (o.queue_pending > 0) parts.push(`${o.queue_pending} scheduled`);

  let base: string;
  if (parts.length === 0) {
    base = 'Your workspace is a blank canvas — open the Forge and create your first carousel.';
  } else if (parts.length === 1) {
    base = `You have ${parts[0]}.`;
  } else {
    base = `You have ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
  }
  if (topTrend) base += ` ${topTrend}`;
  return base;
}

const EVERGREEN_SEEDS = [
  'A contrarian take on what everyone in my niche gets wrong',
  '5 mistakes costing you followers right now',
  'The one habit that quietly grows an audience',
  'Why most content fails in the first 3 seconds',
];

function coverOf(c: CarouselRow): string | null {
  const slides = (c as unknown as { slides?: Array<{ imageUrl?: string }> }).slides;
  if (Array.isArray(slides)) {
    const hit = slides.find((s) => s?.imageUrl)?.imageUrl;
    return hit ?? null;
  }
  return null;
}

export default async function HomePage() {
  let overview: OrgOverview | null = null;
  let insights: InsightCard[] = [];
  let carousels: CarouselRow[] = [];
  let runs: PipelineRun[] = [];
  const niche: string | null = null;
  let connectionError: string | null = null;

  // Perf: every engine→Supabase call is ~1s. Home fans out the 4 it truly
  // needs in parallel (overview + insights are micro-cached engine-side, so
  // warm loads are near-instant). The brand call was DROPPED from home — it
  // was only flavoring sparks and cost ~1.5s uncached, bounding the whole
  // page. Sparks fall back to evergreen seeds, which is plenty.
  try {
    const [ov, ins, lib, rr] = await Promise.allSettled([
      api.overview(),
      api.intelligence.insights('dashboard'),
      api.listCarousels(12),
      api.recentRuns(6),
    ]);
    if (ov.status === 'fulfilled') overview = ov.value.overview;
    if (ins.status === 'fulfilled') insights = ins.value.insights as InsightCard[];
    if (lib.status === 'fulfilled') carousels = lib.value.carousels;
    if (rr.status === 'fulfilled') runs = rr.value.runs;
    if (ov.status === 'rejected') connectionError = 'Engine unreachable.';
  } catch (err) {
    connectionError = err instanceof Error ? err.message : 'Engine unreachable.';
  }

  // ---- derive section data ----
  const topTrend = insights.find((i) => i.kind === 'trend')?.headline;
  const synthesis = buildSynthesis(overview, topTrend);

  const resumable: ResumableCarousel[] = carousels
    .filter((c) => ['ready', 'draft', 'approved'].includes(c.status))
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      title: c.title,
      hook: c.hook,
      status: c.status,
      slide_count: c.slide_count,
      cover: coverOf(c),
      created_at: c.created_at,
    }));

  // Sparks: niche-flavored evergreen seeds + "make another like X" from recents.
  const nichePrefix = niche ? ` for ${niche}` : '';
  const recentSeeds = carousels
    .slice(0, 2)
    .map((c) => c.title || c.hook)
    .filter((t): t is string => !!t)
    .map((t) => `A fresh angle on "${t.slice(0, 48)}"`);
  const sparks = [
    ...recentSeeds,
    ...EVERGREEN_SEEDS.map((s) => (niche ? s.replace('my niche', niche) : s) + (s.includes('niche') ? '' : nichePrefix)),
  ].slice(0, 6);

  const pulseSeed: SeedEntry[] = runs.slice(0, 6).map((r) => ({
    label:
      r.status === 'completed'
        ? `Forged a carousel`
        : r.status === 'failed'
          ? `A run needed attention`
          : `Pipeline ${r.current_step ?? 'step'}`,
    when: fmtRelative(r.started_at),
  }));

  return (
    <div className="space-y-7">
      <BriefBar synthesis={synthesis} workspaceName={overview?.name ?? 'your workspace'} />

      {connectionError && (
        <div className="rounded-lg border border-state-danger/40 bg-state-danger-bg px-4 py-3 text-sm text-state-danger">
          <strong className="font-semibold">Engine unreachable —</strong> {connectionError}
        </div>
      )}

      <TelemetryStrip
        pending={overview?.pending_topics ?? 0}
        ready={overview?.ready_carousels ?? 0}
        scheduled={overview?.queue_pending ?? 0}
        published={overview?.published_total ?? 0}
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column — opportunities + resumable work + sparks */}
        <div className="space-y-7">
          <OpportunityFeed initial={insights} />
          <ContinueCreating items={resumable} />
          <TrendingSparks seeds={sparks} />
        </div>

        {/* Side column — the heartbeat */}
        <div className="space-y-7">
          <PulseLog seed={pulseSeed} />
        </div>
      </div>
    </div>
  );
}
