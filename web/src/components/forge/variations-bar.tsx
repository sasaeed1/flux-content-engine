'use client';

/**
 * VariationsBar — the "stay & sculpt" loop after a carousel is forged.
 *
 * One-click refinements that re-run just the needed piece: sharper hook /
 * punchier CTA (each opens the before/after SlideDiff), restyle cinematic
 * (re-renders under a cinematic style, no LLM). A primary "Ship it" fires a
 * success-bloom and hands off to the detail surface for final approval. You
 * never leave the chamber to iterate.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Sparkles, Type, Wand2, Zap } from 'lucide-react';
import {
  rewriteSlideAction,
  restyleCarouselAction,
} from '@/app/(app)/carousels/[id]/edit-actions';
import { SlideDiff, type SlideVersion } from '@/components/carousel/slide-diff';
import type { StyleMode } from '@/components/flux/style-tile';
import { beginEngineTask, reportEngineActivity } from '@/lib/use-engine-activity';
import { cn } from '@/lib/utils';

const CINEMATIC_KEYS = ['cinematic-poster', 'luxury-black', 'documentary-storytelling', 'high-fashion-magazine'];

export function VariationsBar({
  carouselId,
  hookIndex,
  ctaIndex,
  styles,
}: {
  carouselId: string;
  hookIndex: number | null;
  ctaIndex: number | null;
  styles: StyleMode[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ previous: SlideVersion; next: SlideVersion; style: string } | null>(null);
  const [shipping, setShipping] = useState(false);

  const cinematicKey =
    CINEMATIC_KEYS.find((k) => styles.some((s) => s.key === k)) ??
    styles.find((s) => s.category === 'cinematic')?.key ??
    null;

  const refineSlide = (key: string, idx: number, style: 'rewrite-hook' | 'rewrite-cta') => {
    setBusyKey(key);
    setNote(null);
    const done = beginEngineTask(key === 'hook' ? 'Sharpening the hook' : 'Tightening the CTA');
    start(async () => {
      try {
        const res = await rewriteSlideAction(carouselId, idx, style);
        const r = res as { previous?: SlideVersion; next?: SlideVersion; style?: string };
        if (r.previous && r.next) {
          setDiff({ previous: r.previous, next: r.next, style: r.style ?? style });
        } else {
          setNote('Updated.');
        }
        reportEngineActivity(key === 'hook' ? 'Sharpened a hook' : 'Tightened a CTA');
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Could not refine.');
      } finally {
        setBusyKey(null);
        done();
      }
    });
  };

  const restyle = () => {
    if (!cinematicKey) return;
    setBusyKey('restyle');
    setNote(null);
    const done = beginEngineTask('Restyling cinematic');
    start(async () => {
      try {
        await restyleCarouselAction(carouselId, cinematicKey);
        setNote('Restyled cinematic — open detail to view the new render.');
        reportEngineActivity('Restyled a carousel');
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Could not restyle.');
      } finally {
        setBusyKey(null);
        done();
      }
    });
  };

  const ship = () => {
    setShipping(true);
    // Let the bloom play, then hand off to detail for the approval surface.
    setTimeout(() => router.push(`/library/${carouselId}`), 620);
  };

  const chips: Array<{ key: string; label: string; icon: typeof Wand2; onClick: () => void; show: boolean }> = [
    {
      key: 'hook',
      label: 'Sharper hook',
      icon: Zap,
      onClick: () => hookIndex !== null && refineSlide('hook', hookIndex, 'rewrite-hook'),
      show: hookIndex !== null,
    },
    {
      key: 'cta',
      label: 'Punchier CTA',
      icon: Type,
      onClick: () => ctaIndex !== null && refineSlide('cta', ctaIndex, 'rewrite-cta'),
      show: ctaIndex !== null,
    },
    {
      key: 'restyle',
      label: 'Restyle cinematic',
      icon: Sparkles,
      onClick: restyle,
      show: !!cinematicKey,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-dim">
          <Wand2 className="h-3 w-3" /> Sculpt
        </span>
        {chips
          .filter((c) => c.show)
          .map((c) => {
            const Icon = c.icon;
            const isBusy = busyKey === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                disabled={pending}
                className="press inline-flex items-center gap-1.5 rounded-pill border border-edge-strong bg-surface-1 px-3 py-1.5 text-[12.5px] font-medium text-fg-muted transition hover:border-flux-violet/45 hover:text-fg disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5 text-flux-violet-bright" />}
                {c.label}
              </button>
            );
          })}

        {/* Ship it — success-bloom */}
        <button
          type="button"
          onClick={ship}
          disabled={pending || shipping}
          className={cn(
            'press relative ml-auto inline-flex items-center gap-2 overflow-visible rounded-sm bg-flux-gradient px-4 py-2 text-[13px] font-bold text-flux-ink glow-cta',
          )}
        >
          {shipping && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flux-cyan animate-success-bloom"
            />
          )}
          <Send className="h-3.5 w-3.5" /> Ship it
        </button>
      </div>

      {note && <p className="px-1 text-xs text-fg-muted">{note}</p>}

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
