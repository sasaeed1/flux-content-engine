'use client';

/**
 * ForgeChamber — the immersive canvas at the heart of the Forge.
 *
 * Four felt states:
 *   idle      → a calm invitation; if a style is picked, your words preview in it
 *   generating→ a conic-halo ignites, the reasoning track narrates, slides
 *               materialize one by one with scan-line builds
 *   settled   → the finished set rests (NO auto-redirect); ship or sculpt
 *   error     → a clear, recoverable failure
 *
 * Wraps the existing usePipelineStream state — pure presentation here.
 */
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import type { PipelineStreamState } from '@/lib/use-pipeline-stream';
import type { StyleMode } from '@/components/flux/style-tile';
import { ReasoningTrack } from './reasoning-track';
import { ForgeSlideTile, type ForgeTile } from './forge-slide-tile';
import { LiveStylePreview } from './live-style-preview';

export function ForgeChamber({
  state,
  selectedStyle,
  topic,
  recommended,
  onReset,
  footerSlot,
}: {
  state: PipelineStreamState;
  selectedStyle: StyleMode | null;
  topic: string;
  recommended: boolean;
  onReset: () => void;
  /** VariationsBar / ship controls injected by the wrapper (step 9). */
  footerSlot?: React.ReactNode;
}) {
  const idle = state.status === 'idle';
  const busy = state.status === 'connecting' || state.status === 'running';
  const done = state.status === 'complete';
  const error = state.status === 'error';

  // Build the tile list: rendered slides + placeholders up to the known total.
  const total = Math.max(state.totalSlides, state.content?.slideCount ?? 0, state.slides.length);
  const activeIndex = state.slides.length; // the next one being worked on
  const tiles: ForgeTile[] = Array.from({ length: total || 0 }).map((_, i) => {
    const rendered = state.slides.find((s) => s.index === i);
    const role = state.content?.slides?.find((s) => s.index === i)?.role;
    return {
      index: i,
      role,
      rendered: rendered ? { publicUrl: rendered.publicUrl } : undefined,
      isActive: busy && i === activeIndex,
    };
  });

  /* ---------------- IDLE ---------------- */
  if (idle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-4 py-10 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-flux-violet/15 ring-1 ring-flux-violet/30">
            <Sparkles className="h-7 w-7 text-flux-violet-bright animate-breathe" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            What do you want to <span className="gradient-text-glow">create</span>?
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-fg-muted">
            Drop a topic below. Flux thinks out loud, proposes angles, and forges
            your carousel live — slide by slide.
          </p>
        </div>

        {selectedStyle && (
          <div className="w-full max-w-[280px]">
            <LiveStylePreview style={selectedStyle} hookText={topic} recommended={recommended} />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- GENERATING / SETTLED / ERROR ---------------- */
  return (
    <div className="flex h-full flex-col gap-5 px-1 py-2">
      {/* halo + reasoning */}
      <div className="relative rounded-xl border border-edge-subtle bg-surface-0/60 p-4">
        {busy && (
          <div
            aria-hidden
            className="conic-halo pointer-events-none absolute -inset-px rounded-xl opacity-30"
            style={{
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
            }}
          />
        )}
        <div className="relative">
          <ReasoningTrack state={state} />
        </div>
      </div>

      {/* live content header */}
      {(state.content?.hook || state.content?.title || state.topic) && (
        <div className="px-1">
          <div className="text-label text-fg-dim">
            {state.brandName ? `${state.brandName} · ` : ''}
            {done ? 'Forged' : 'Producing'}
          </div>
          <div className="mt-1 font-display text-lg font-semibold leading-tight">
            {state.content?.title ?? state.content?.hook ?? state.topic}
          </div>
        </div>
      )}

      {/* slide grid — suppressed in draft mode (no images yet; DraftEditor shows) */}
      {!state.isDraft && (
        <div className="flex flex-wrap gap-3">
          {tiles.length === 0 ? (
            <div className="flex w-full items-center justify-center py-12">
              <div className="relative h-14 w-14">
                <div className="conic-halo absolute inset-0 rounded-full opacity-70" />
                <div className="absolute inset-1 rounded-full bg-surface-0" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-flux-violet-bright" />
              </div>
            </div>
          ) : (
            tiles.map((t) => <ForgeSlideTile key={t.index} tile={t} size={180} />)
          )}
        </div>
      )}

      {/* error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-state-danger/30 bg-state-danger-bg px-4 py-3 text-sm text-state-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{state.error}</span>
          <button type="button" onClick={onReset} className="press inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {/* settled footer */}
      {done && (
        <div className="space-y-4">
          {!state.isDraft && (
            <div className="flex items-center gap-2 rounded-lg border border-state-success/30 bg-state-success-bg px-4 py-2.5 text-sm text-state-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="flex-1">
                {state.slides.length} slide{state.slides.length === 1 ? '' : 's'} forged. Sculpt it, or ship it.
              </span>
              {state.carouselId && (
                <Link
                  href={`/library/${state.carouselId}`}
                  className="press inline-flex items-center gap-1 font-semibold text-state-success underline-offset-2 hover:underline"
                >
                  Open in detail <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}
          {footerSlot}
          <button
            type="button"
            onClick={onReset}
            className="press inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted transition hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Forge another
          </button>
        </div>
      )}
    </div>
  );
}
