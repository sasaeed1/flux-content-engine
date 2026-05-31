import { cn } from '@/lib/utils';

export interface RankRow {
  key: string;
  sample_size: number;
  avg_engagement: number;
}

/**
 * RankList — a ranked performance list with engagement bars. Used on Signals
 * for top hooks / styles / CTAs. Pure server component (CSS-width bars).
 */
export function RankList({
  title,
  rows,
  accent,
  emptyHint,
}: {
  title: string;
  rows: RankRow[];
  accent: string;
  emptyHint: string;
}) {
  const max = Math.max(0.0001, ...rows.map((r) => r.avg_engagement));
  return (
    <div className="solid-card rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-label text-fg-muted">{title}</h3>
        <span className="h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
      </div>
      {rows.length === 0 ? (
        <p className="text-xs leading-relaxed text-fg-dim">{emptyHint}</p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 6).map((r, i) => {
            const pct = Math.round((r.avg_engagement / max) * 100);
            return (
              <li key={r.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-[10px] text-fg-dim">{i + 1}</span>
                    <span className="truncate capitalize text-fg">{r.key.replace(/[-_]/g, ' ')}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-fg-muted">
                    {(r.avg_engagement * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn('h-full rounded-full')}
                    style={{ width: `${pct}%`, background: accent }}
                  />
                </div>
                <div className="text-[10px] text-fg-dim">n={r.sample_size}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
