import Link from 'next/link';
import { Activity, Eye, Send, TrendingUp, Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { RankList } from '@/components/signals/rank-list';
import { WeeklyBriefing, type BriefingCard } from '@/components/signals/weekly-briefing';
import { api } from '@/lib/api-client';
import type { OrgOverview } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signals' };

interface PerfTop {
  sample_size: number;
  top_hooks: Array<{ key: string; sample_size: number; avg_engagement: number }>;
  top_styles: Array<{ key: string; sample_size: number; avg_engagement: number }>;
  top_ctas: Array<{ key: string; sample_size: number; avg_engagement: number }>;
}

export default async function SignalsPage() {
  let overview: OrgOverview | null = null;
  let perf: PerfTop = { sample_size: 0, top_hooks: [], top_styles: [], top_ctas: [] };
  let briefing: BriefingCard | null = null;

  try {
    const [ov, pt, ins] = await Promise.allSettled([
      api.overview(),
      api.intelligence.performanceTop(),
      api.intelligence.insights('signals'),
    ]);
    if (ov.status === 'fulfilled') overview = ov.value.overview;
    if (pt.status === 'fulfilled') perf = pt.value as PerfTop;
    if (ins.status === 'fulfilled') {
      const weekly = ins.value.insights.find((i) => i.kind === 'weekly');
      if (weekly) {
        briefing = {
          headline: weekly.headline,
          body: weekly.body,
          cta_label: weekly.cta_label,
          cta_href: weekly.cta_href,
          created_at: weekly.created_at,
        };
      }
    }
  } catch {
    /* keep empties */
  }

  const hasSignal = perf.sample_size > 0;
  const topHook = perf.top_hooks[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance intelligence"
        title={
          <>
            Your <span className="gradient-text">signals</span>.
          </>
        }
        subtitle="What's resonating — the patterns Flux is learning from your published work and feeding back into every new generation."
      />

      {/* AI weekly briefing */}
      <WeeklyBriefing initial={briefing} />

      {/* headline metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Published', value: overview?.published_total ?? 0, icon: Send, color: '#34D399' },
          { label: 'Total views', value: overview?.total_views ?? 0, icon: Eye, color: '#22D3EE' },
          { label: 'Samples learned', value: perf.sample_size, icon: Activity, color: '#A78BFA' },
          {
            label: 'Top hook',
            value: 0,
            text: topHook ? topHook.key.replace(/[-_]/g, ' ') : '—',
            icon: TrendingUp,
            color: '#F5B544',
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="solid-card rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-label text-fg-dim">{m.label}</span>
                <Icon className="h-3.5 w-3.5" style={{ color: m.color }} />
              </div>
              <div className="mt-2 font-display text-xl font-semibold capitalize tracking-tight">
                {'text' in m && m.text !== undefined ? m.text : m.value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {!hasSignal ? (
        <div className="solid-card rounded-2xl p-12 text-center pattern-dots">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-flux-violet/15">
            <Activity className="h-6 w-6 text-flux-violet-bright animate-breathe" />
          </div>
          <p className="mt-3 text-base font-semibold">Flux is gathering signal</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
            Once you publish carousels and analytics sync, Flux learns which hooks, styles, and
            CTAs resonate — and biases every future generation toward what works. Forge and ship a
            few to light this up.
          </p>
          <Link
            href="/forge"
            className="press mt-4 inline-flex items-center gap-2 rounded-sm bg-flux-gradient px-4 py-2 text-sm font-bold text-flux-ink glow-cta"
          >
            <Wand2 className="h-4 w-4" /> Open the Forge
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <RankList
              title="Top hook archetypes"
              rows={perf.top_hooks}
              accent="#A78BFA"
              emptyHint="No hook signal yet."
            />
            <RankList
              title="Top style modes"
              rows={perf.top_styles}
              accent="#22D3EE"
              emptyHint="No style signal yet."
            />
            <RankList
              title="Top CTAs"
              rows={perf.top_ctas}
              accent="#F5B544"
              emptyHint="No CTA signal yet."
            />
          </div>

          {topHook && (
            <div className="rounded-lg border border-flux-violet/25 bg-flux-violet/[0.06] px-5 py-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-flux-violet-bright" />
                <p className="text-sm leading-relaxed text-fg">
                  Flux is biasing new carousels toward your{' '}
                  <span className="font-semibold capitalize text-flux-violet-bright">
                    {topHook.key.replace(/[-_]/g, ' ')}
                  </span>{' '}
                  hooks — they&apos;re averaging{' '}
                  <span className="font-mono">{(topHook.avg_engagement * 100).toFixed(1)}%</span>{' '}
                  engagement across {topHook.sample_size} posts. This feedback loop runs
                  automatically on every generation.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
