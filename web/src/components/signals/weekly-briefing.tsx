'use client';

/**
 * WeeklyBriefing — the AI-written weekly summary card on Signals (Sprint E).
 * Reads the latest kind='weekly' insight (passed in) and offers an on-demand
 * regenerate that lights the Engine Pulse.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarRange, Loader2, RefreshCw } from 'lucide-react';
import { refreshWeeklyBriefingAction } from '@/app/(app)/signals/actions';
import { beginEngineTask, reportEngineActivity } from '@/lib/use-engine-activity';

export interface BriefingCard {
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  created_at: string;
}

export function WeeklyBriefing({ initial }: { initial: BriefingCard | null }) {
  const [card, setCard] = useState<BriefingCard | null>(initial);
  const [pending, start] = useTransition();

  const refresh = () => {
    const done = beginEngineTask('Writing your weekly briefing');
    start(async () => {
      try {
        await refreshWeeklyBriefingAction();
        reportEngineActivity('Wrote the weekly briefing');
        setTimeout(() => window.location.reload(), 500);
      } catch {
        /* ignore */
      } finally {
        done();
      }
    });
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-flux-violet/25 p-5 sm:p-6"
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(34,211,238,0.05) 60%, transparent)',
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-flux-violet/15 text-flux-violet-bright">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <div className="text-label text-fg-dim">Weekly briefing</div>
            <div className="text-[11px] text-fg-muted">AI-written from your performance</div>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="press inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim transition hover:text-flux-violet-bright disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {pending ? 'Writing' : card ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {card ? (
        <>
          <h2 className="font-display text-lg font-semibold tracking-tight">{card.headline}</h2>
          {card.body && (
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-fg-muted">
              {card.body}
            </p>
          )}
          {card.cta_label && card.cta_href && (
            <Link
              href={card.cta_href}
              className="press mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-flux-violet-bright transition hover:gap-2.5"
            >
              {card.cta_label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      ) : (
        <p className="text-sm text-fg-muted">
          No briefing yet. Generate one to get a plain-English read on your week and the single
          highest-leverage move for next week.
        </p>
      )}
    </section>
  );
}
