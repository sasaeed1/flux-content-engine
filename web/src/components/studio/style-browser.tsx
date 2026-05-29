'use client';

/**
 * Style browser — 40-tile picker that sits in the Studio's left column.
 * Filtered by category. Active tile glows. Click → applies to the studio
 * session (state lifted in the parent).
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { StyleMode, StyleTile } from '@/components/flux/style-tile';

const CATEGORIES = [
  'all',
  'minimal',
  'luxury',
  'editorial',
  'tech',
  'cinematic',
  'corporate',
  'playful',
  'cultural',
];

export function StyleBrowser({
  modes,
  activeKey,
  onSelect,
}: {
  modes: StyleMode[];
  activeKey?: string | null;
  onSelect: (key: string) => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return modes.filter((m) => {
      if (filter !== 'all' && m.category !== filter) return false;
      if (qq && !`${m.name} ${m.description} ${m.emotional_tone}`.toLowerCase().includes(qq)) {
        return false;
      }
      return true;
    });
  }, [modes, filter, q]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Style modes
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {filtered.length}/{modes.length}
          </span>
        </div>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search styles…"
            className="h-8 w-full rounded-lg border border-border/50 bg-secondary/30 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {CATEGORIES.map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition ${
                  active
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 scroll-hide"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filtered.map((m) => (
          <StyleTile
            key={m.key}
            mode={m}
            active={activeKey === m.key}
            onSelect={() => onSelect(m.key)}
          />
        ))}
      </div>
    </div>
  );
}
