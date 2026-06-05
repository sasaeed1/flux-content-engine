'use client';

/**
 * TopicClusters — group the current topic queue into AI "content pillars".
 * On-demand (a single LLM call); read-only analysis that never mutates topics.
 */
import { useState, useTransition } from 'react';
import { Layers, Loader2, Sparkles } from 'lucide-react';
import { clusterTopicsAction } from '@/app/(app)/campaign/actions';

interface Cluster {
  label: string;
  summary: string;
  count: number;
  topics: string[];
  topicIds: string[];
}

const ACCENTS = ['#A78BFA', '#22D3EE', '#34D399', '#F5B544', '#EC4899', '#60A5FA'];

export function TopicClusters() {
  const [pending, start] = useTransition();
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = () => {
    if (pending) return;
    setMsg(null);
    start(async () => {
      try {
        const res = await clusterTopicsAction();
        setClusters(res.clusters);
        if (res.clusters.length === 0) setMsg(res.message ?? 'Not enough topics yet.');
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Could not cluster topics right now.');
      }
    });
  };

  return (
    <div className="solid-card space-y-3 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="h-4 w-4 text-flux-violet-bright" />
        <h3 className="text-label text-fg-muted">Content pillars</h3>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="press ml-auto inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-surface-1 px-3 py-1.5 text-[13px] font-semibold text-fg transition hover:border-flux-violet/50 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-flux-violet-bright" />
          )}
          {clusters ? 'Re-analyze' : 'Find pillars'}
        </button>
      </div>
      <p className="text-[11px] text-fg-dim">
        Group your topic queue into the recurring themes that carry a feed — so you can see
        your content strategy at a glance.
      </p>
      {msg && <div className="text-[11px] text-fg-dim">{msg}</div>}
      {clusters && clusters.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((c, i) => (
            <div
              key={c.label}
              className="rounded-lg border border-edge-subtle bg-surface-1 p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: ACCENTS[i % ACCENTS.length] }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{c.label}</span>
                <span className="shrink-0 rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-fg-dim">
                  {c.count}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-fg-muted">{c.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.topics.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="max-w-[150px] truncate rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-fg-dim"
                    title={t}
                  >
                    {t}
                  </span>
                ))}
                {c.topics.length > 4 && (
                  <span className="text-[10px] text-fg-dim">+{c.topics.length - 4}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
