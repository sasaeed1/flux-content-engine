'use client';

/**
 * Restyle switcher — post-audit #4.
 *
 * Dropdown that lets the user swap the visual style mode of an existing
 * carousel without rerunning the whole pipeline. The server re-renders every
 * slide under the new style mode (~1 PNG per slide, no LLM cost) and returns
 * the new image URLs.
 *
 * Sits in the carousel detail header next to the title.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Palette } from 'lucide-react';
import { restyleCarouselAction } from '@/app/(app)/carousels/[id]/edit-actions';

export interface StyleOption {
  key: string;
  name: string;
  category: string | null;
}

export function RestyleSwitcher({
  carouselId,
  currentStyleModeKey,
  styles,
}: {
  carouselId: string;
  currentStyleModeKey: string | null;
  styles: StyleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(currentStyleModeKey);

  useEffect(() => {
    setActiveKey(currentStyleModeKey);
  }, [currentStyleModeKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-restyle]')) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const restyle = (key: string) => {
    if (key === activeKey) {
      setOpen(false);
      return;
    }
    setErr(null);
    setOpen(false);
    start(async () => {
      try {
        await restyleCarouselAction(carouselId, key);
        setActiveKey(key);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Restyle failed.');
      }
    });
  };

  // Group styles by category for the dropdown.
  const groups = new Map<string, StyleOption[]>();
  for (const s of styles) {
    const cat = s.category ?? 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(s);
  }

  const activeStyle = styles.find((s) => s.key === activeKey);

  return (
    <div data-restyle className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted/40 disabled:opacity-50"
        title="Re-render under a different style mode (no full pipeline rerun)"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <Palette className="h-3.5 w-3.5 text-primary" />
        )}
        <span>Style:</span>
        <span className="font-bold text-foreground">
          {activeStyle?.name ?? activeKey ?? 'default'}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[60vh] w-[260px] overflow-y-auto rounded-xl border border-border/60 bg-card/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {[...groups.entries()].map(([cat, items]) => (
            <div key={cat} className="px-1.5 py-1.5">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {cat}
              </div>
              <ul>
                {items.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => restyle(s.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-muted/40 ${
                        s.key === activeKey
                          ? 'bg-primary/15 font-semibold text-primary'
                          : ''
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      {s.key === activeKey && (
                        <span className="text-[10px] opacity-70">current</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 shadow-lg">
          {err}
        </div>
      )}
    </div>
  );
}
