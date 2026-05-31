'use client';

/**
 * OpportunityFeed — the centerpiece of Home.
 *
 * A prioritized, stagger-revealing stream of things to DO, surfaced from the
 * engine's intelligence.insights (built long ago, never shown on the old dead
 * dashboard — the audit's #1 gap). Each card deep-links into the Forge
 * pre-seeded. A quiet "refresh" lets the user ask the engine to look again,
 * which lights the global Engine Pulse.
 */
import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { PresenceCards, type InsightCard } from '@/components/flux/presence-card';
import { dismissHomeInsightAction, refreshHomeInsightsAction } from '@/app/(app)/home/actions';
import { beginEngineTask, reportEngineActivity } from '@/lib/use-engine-activity';

export function OpportunityFeed({ initial }: { initial: InsightCard[] }) {
  const [cards, setCards] = useState<InsightCard[]>(initial);
  const [pending, start] = useTransition();

  const onDismiss = (id: string) => {
    setCards((c) => c.filter((x) => x.id !== id));
    void dismissHomeInsightAction(id);
  };

  const onRefresh = () => {
    const done = beginEngineTask('Scanning your workspace for opportunities');
    start(async () => {
      try {
        await refreshHomeInsightsAction();
        reportEngineActivity('Refreshed opportunities');
        // Soft reload to pull the freshly-generated cards.
        setTimeout(() => window.location.reload(), 400);
      } catch {
        /* ignore */
      } finally {
        done();
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-flux-violet-bright" />
          <h2 className="font-display text-base font-semibold tracking-tight">
            Opportunities
          </h2>
          {cards.length > 0 && (
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-fg-muted">
              {cards.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="press inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim transition hover:text-flux-violet-bright disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {pending ? 'Scanning' : 'Refresh'}
        </button>
      </div>

      <PresenceCards
        insights={cards}
        onDismiss={onDismiss}
        emptyHint="Flux is observing your workspace. Ship a few carousels and opportunities — trends, optimizations, next moves — will start streaming in here."
      />
    </section>
  );
}
