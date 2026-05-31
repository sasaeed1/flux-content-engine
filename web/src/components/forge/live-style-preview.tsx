'use client';

/**
 * LiveStylePreview — see the pairing before you commit.
 *
 * Renders a live sample slide using YOUR actual topic/hook in the selected
 * style (wraps MotionPreview). Flux marks one style "recommended for this
 * topic" with a gold opportunity badge. This closes the Studio audit's biggest
 * gap: there was no way to preview a style against your words before running.
 */
import { Sparkles, Star } from 'lucide-react';
import { MotionPreview, type MotionStyleMode } from '@/components/flux/motion-preview';
import type { StyleMode } from '@/components/flux/style-tile';

function toMotion(style: StyleMode): MotionStyleMode {
  return {
    key: style.key,
    name: style.name,
    typography: style.typography as MotionStyleMode['typography'],
    palette: style.palette as unknown as MotionStyleMode['palette'],
    motion: style.motion as MotionStyleMode['motion'],
    effects: style.effects as MotionStyleMode['effects'],
  };
}

export function LiveStylePreview({
  style,
  hookText,
  recommended = false,
}: {
  style: StyleMode | null;
  hookText: string;
  recommended?: boolean;
}) {
  if (!style) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-edge-strong bg-surface-0 p-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-flux-violet/15">
          <Sparkles className="h-5 w-5 text-flux-violet-bright animate-breathe" />
        </div>
        <p className="text-[13px] leading-relaxed text-fg-muted">
          Pick a style and watch your words come to life in it — before you forge.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {recommended && (
        <div className="absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-pill bg-flux-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink shadow-[0_4px_16px_-4px_rgba(245,181,68,0.6)]">
          <Star className="h-3 w-3" /> Recommended
        </div>
      )}
      <MotionPreview
        style={toMotion(style)}
        hookText={hookText}
        className="aspect-square w-full ring-1 ring-edge-strong"
      />
      <div className="mt-2 flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold">{style.name}</span>
        <span className="text-[11px] capitalize text-fg-dim">{style.category}</span>
      </div>
    </div>
  );
}
