'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { rewriteSlideAction } from '@/app/(app)/carousels/[id]/edit-actions';
import { SlideDiff, type SlideVersion } from './slide-diff';

type Style = 'rewrite' | 'shorter' | 'denser' | 'rewrite-hook' | 'rewrite-cta';

const OPTIONS: Array<{ value: Style; label: string; icon: typeof Sparkles }> = [
  { value: 'rewrite', label: 'Rewrite slide text', icon: Wand2 },
  { value: 'shorter', label: 'Make slide shorter', icon: Minimize2 },
  { value: 'denser', label: 'Add more density', icon: Maximize2 },
  { value: 'rewrite-hook', label: 'Try a different hook', icon: Sparkles },
  { value: 'rewrite-cta', label: 'Rewrite CTA', icon: RefreshCw },
];

export function SlideActions({
  carouselId,
  slideIndex,
  slideRole,
}: {
  carouselId: string;
  slideIndex: number;
  slideRole: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [hint, setHint] = useState<string | null>(null);
  // Post-audit #4 — captured from the rewrite response, drives the diff modal.
  const [diff, setDiff] = useState<{
    previous: SlideVersion;
    next: SlideVersion;
    style: string;
  } | null>(null);

  const run = (style: Style) =>
    start(async () => {
      setOpen(false);
      setHint(null);
      try {
        const res = await rewriteSlideAction(carouselId, slideIndex, style);
        // The endpoint now returns previous + next slide data so we can show a
        // side-by-side diff. Fall back to the old behavior if the field
        // shape is missing (defensive — old client cache).
        if (res && (res as { previous?: SlideVersion }).previous && (res as { next?: SlideVersion }).next) {
          setDiff({
            previous: (res as { previous: SlideVersion }).previous,
            next: (res as { next: SlideVersion }).next,
            style: ((res as { style?: string }).style ?? style) as string,
          });
        } else {
          setHint('Updated. Re-render to refresh the image.');
        }
        router.refresh();
      } catch (e) {
        setHint(e instanceof Error ? e.message : 'Edit failed.');
      }
    });

  // Slightly different default options based on role.
  const isHook = slideRole === 'hook';
  const isCta = slideRole === 'cta';
  const visible = OPTIONS.filter((o) => {
    if (o.value === 'rewrite-hook' && !isHook) return false;
    if (o.value === 'rewrite-cta' && !isCta) return false;
    return true;
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Wand2 className="h-3 w-3" />
        )}
        Edit
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <ul
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/60 bg-card text-foreground shadow-2xl"
        >
          {visible.map((o) => {
            const Icon = o.icon;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => run(o.value)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-muted/40"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hint && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-black/80 px-3 py-2 text-[11px] text-white shadow-lg backdrop-blur">
          {hint}
        </div>
      )}

      {diff && (
        <SlideDiff
          carouselId={carouselId}
          previous={diff.previous}
          next={diff.next}
          style={diff.style}
          onClose={() => setDiff(null)}
          onReverted={() => router.refresh()}
        />
      )}
    </div>
  );
}
