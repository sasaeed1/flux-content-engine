'use client';

/**
 * StyleGallery — the 40 cinematic style modes, browsable with BOTH a static
 * preview (the fast tile grid) and a live MOTION preview (the selected mode
 * animates in the detail panel). Category-filterable. This is the home for the
 * style library inside Brand Studio › Looks.
 */
import { useMemo, useState } from 'react';
import { Film, ImageIcon, Layers } from 'lucide-react';
import { StyleTile, type StyleMode } from '@/components/flux/style-tile';
import { MotionPreview, type MotionStyleMode } from '@/components/flux/motion-preview';
import { cn } from '@/lib/utils';

function toMotion(s: StyleMode): MotionStyleMode {
  return {
    key: s.key,
    name: s.name,
    typography: s.typography as MotionStyleMode['typography'],
    palette: s.palette as unknown as MotionStyleMode['palette'],
    motion: s.motion as MotionStyleMode['motion'],
    effects: s.effects as MotionStyleMode['effects'],
  };
}

function swatches(p: Record<string, string | string[]>): string[] {
  const out: string[] = [];
  for (const k of ['background', 'foreground', 'accent', 'accent_soft', 'muted']) {
    const v = p[k];
    if (typeof v === 'string') out.push(v);
  }
  return out.slice(0, 5);
}

export function StyleGallery({ styles }: { styles: StyleMode[] }) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    styles.forEach((s) => s.category && set.add(s.category));
    return ['all', ...Array.from(set).sort()];
  }, [styles]);

  const [cat, setCat] = useState('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(styles[0]?.key ?? null);

  const filtered = cat === 'all' ? styles : styles.filter((s) => s.category === cat);
  const selected = styles.find((s) => s.key === selectedKey) ?? filtered[0] ?? null;

  return (
    <div className="space-y-4">
      {/* header + category filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-dim">
          <Layers className="h-3.5 w-3.5" /> {styles.length} style modes
        </span>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                'press rounded-pill border px-3 py-1 text-[12px] font-medium capitalize transition',
                cat === c
                  ? 'border-flux-cyan/50 bg-surface-2 text-fg ring-1 ring-flux-cyan/25'
                  : 'border-edge-subtle bg-surface-1 text-fg-muted hover:border-edge-strong hover:text-fg',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* static tile grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <StyleTile
              key={s.key}
              mode={s}
              active={s.key === selectedKey}
              onSelect={() => setSelectedKey(s.key)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-fg-muted">
              No styles in this category.
            </p>
          )}
        </div>

        {/* motion preview detail panel (sticky on desktop) */}
        {selected && (
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="solid-card space-y-3 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-flux-violet-bright">
                  <Film className="h-3.5 w-3.5" /> Motion preview
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-fg-dim">
                  <ImageIcon className="h-3 w-3" /> live
                </span>
              </div>

              <MotionPreview style={toMotion(selected)} className="aspect-square w-full ring-1 ring-edge-strong" />

              <div>
                <div className="font-display text-base font-semibold">{selected.name}</div>
                <div className="text-[12px] capitalize text-fg-dim">
                  {selected.category} · {selected.emotional_tone}
                </div>
              </div>

              {selected.description && (
                <p className="text-[12.5px] leading-relaxed text-fg-muted">{selected.description}</p>
              )}

              {/* palette swatches */}
              <div className="flex items-center gap-1.5">
                {swatches(selected.palette as Record<string, string | string[]>).map((hex, i) => (
                  <span
                    key={i}
                    className="h-6 w-6 rounded-md ring-1 ring-white/10"
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>

              {/* motion meta */}
              {(() => {
                const m = selected.motion as { philosophy?: string; intensity?: number };
                return m?.philosophy ? (
                  <div className="flex items-center justify-between rounded-md border border-edge-subtle bg-surface-0 px-3 py-2 text-[11px]">
                    <span className="capitalize text-fg-muted">{m.philosophy} motion</span>
                    <span className="font-mono text-fg-dim">
                      intensity {Math.round((m.intensity ?? 0) * 100)}%
                    </span>
                  </div>
                ) : null;
              })()}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
