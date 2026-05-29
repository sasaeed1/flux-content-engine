'use client';

/**
 * Studio assistant — right column of the studio surface.
 *
 *   Top: PresenceCards (AI recommendations)
 *   Middle: Hook generator (live)
 *   Bottom: link to brand voice for fast tuning
 */
import { useState, useTransition } from 'react';
import { Loader2, Sparkles, Wand2, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PresenceCards, type InsightCard } from '@/components/flux/presence-card';
import {
  dismissInsightAction,
  generateHooksAction,
  refreshInsightsAction,
} from '@/app/(app)/studio/actions';

interface HookOut {
  text: string;
  archetype: string;
  score?: number;
  why?: string;
}

export function StudioAssistant({
  initialInsights,
  defaultTopic,
}: {
  initialInsights: InsightCard[];
  defaultTopic?: string;
}) {
  const [insights, setInsights] = useState<InsightCard[]>(initialInsights);
  const [hooks, setHooks] = useState<HookOut[]>([]);
  const [hookTopic, setHookTopic] = useState(defaultTopic ?? '');
  const [pending, start] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const onDismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    void dismissInsightAction(id);
  };

  const onRefresh = () => {
    setRefreshing(true);
    start(async () => {
      try {
        await refreshInsightsAction();
        // Force a soft reload by leveraging server-side revalidation: easiest
        // path is window.location.reload() — but we want the page to feel
        // alive, so just hide+show after a brief delay (the insights endpoint
        // will repopulate the table; the user can dismiss/regen as they wish).
        setTimeout(() => window.location.reload(), 300);
      } catch (e) {
        console.error(e);
        setRefreshing(false);
      }
    });
  };

  const onHooks = () => {
    if (!hookTopic.trim()) return;
    setHooks([]);
    start(async () => {
      try {
        const res = await generateHooksAction(hookTopic.trim(), 5);
        setHooks(res.hooks);
      } catch (e) {
        console.error(e);
      }
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Insights */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Flux observations
          </h3>
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending || refreshing}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:underline disabled:opacity-50"
          >
            {refreshing || pending ? 'thinking…' : 'refresh'}
          </button>
        </div>
        <PresenceCards insights={insights} onDismiss={onDismiss} />
      </div>

      {/* Hook generator */}
      <div className="rounded-2xl border border-border/40 bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-flux-gradient text-background">
            <Wand2 className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-semibold">Hook factory</h3>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          14 archetypes. Rotates across providers. Free-tier.
        </p>
        <div className="mt-3 space-y-2">
          <textarea
            value={hookTopic}
            onChange={(e) => setHookTopic(e.target.value)}
            rows={2}
            placeholder="Topic…"
            className="w-full resize-none rounded-lg border border-border/50 bg-secondary/30 p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
            disabled={pending}
          />
          <button
            type="button"
            onClick={onHooks}
            disabled={pending || !hookTopic.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-flux-soft px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-flux-soft/80 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Spin up 5 hooks
          </button>
        </div>

        {hooks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {hooks.map((h, i) => (
              <li
                key={i}
                className="rounded-lg border border-border/30 bg-card/30 p-2"
              >
                <div className="text-[11px] text-foreground">{h.text}</div>
                <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.12em]">
                  <span className="text-primary">{h.archetype}</span>
                  {typeof h.score === 'number' && (
                    <span className="text-muted-foreground">
                      score {Math.round(h.score * 100)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Brand voice shortcut */}
      <Link
        href="/brand"
        className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/40 p-3 text-xs transition hover:border-primary/40"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="flex-1 font-semibold">Tune your brand voice</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </Link>
    </div>
  );
}
