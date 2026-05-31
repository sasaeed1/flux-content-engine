'use client';

/**
 * PulseLog — the visible heartbeat. A quiet, live-updating ticker of what Flux
 * has been doing (analyzed carousels, refreshed insights, forged content),
 * proving the engine is alive and working even when you're idle.
 *
 * Merges server-seeded recent activity (from pipeline runs) with the live
 * client engine-activity stream, newest first.
 */
import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useEngineActivity } from '@/lib/use-engine-activity';

export interface SeedEntry {
  label: string;
  /** Relative time string already formatted server-side ("2h ago"). */
  when: string;
}

export function PulseLog({ seed }: { seed: SeedEntry[] }) {
  const { log, isThinking } = useEngineActivity();

  const rows = useMemo(() => {
    const live = log.map((e) => ({
      key: `live-${e.id}`,
      label: e.label,
      when: e.endedAt ? 'just now' : 'now',
      active: e.endedAt === null,
    }));
    const seeded = seed.map((s, i) => ({
      key: `seed-${i}`,
      label: s.label,
      when: s.when,
      active: false,
    }));
    return [...live, ...seeded].slice(0, 8);
  }, [log, seed]);

  return (
    <section className="rounded-xl border border-edge-subtle bg-surface-0 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity
          className={`h-4 w-4 ${isThinking ? 'text-flux-violet-bright' : 'text-fg-muted'}`}
        />
        <h3 className="text-label text-fg-muted">Engine pulse</h3>
        {isThinking && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-flux-violet-bright">
            <span className="h-1.5 w-1.5 rounded-full bg-flux-violet animate-pulse" />
            Live
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-fg-dim">Quiet for now. The engine logs its work here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2.5 text-[12.5px]">
              <span
                className={
                  r.active
                    ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-flux-violet shadow-[0_0_8px_1px_rgba(139,92,246,0.7)]'
                    : 'h-1.5 w-1.5 shrink-0 rounded-full bg-fg-dim/50'
                }
              />
              <span className="min-w-0 flex-1 truncate text-fg-muted">{r.label}</span>
              <span className="shrink-0 font-mono text-[10px] text-fg-dim">{r.when}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
