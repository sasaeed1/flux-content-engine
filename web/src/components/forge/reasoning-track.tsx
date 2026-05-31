'use client';

/**
 * ReasoningTrack — the engine's reasoning made visible during generation.
 *
 * Replaces the abstract 7-dot phase strip with a granular, human-readable
 * track: "Researching → Writing slide 3/6 (Hero) → Rendering". An activity
 * pulse rides the active segment so the intelligence is felt at the moment of
 * creation (the audit's biggest motion gap).
 */
import type { PipelineStreamState } from '@/lib/use-pipeline-stream';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'boot', label: 'Igniting' },
  { key: 'topic', label: 'Framing topic' },
  { key: 'voice', label: 'Loading voice' },
  { key: 'write', label: 'Writing slides' },
  { key: 'render', label: 'Rendering' },
  { key: 'done', label: 'Done' },
] as const;

function stageIndex(state: PipelineStreamState): number {
  switch (state.phase) {
    case 'started':
    case 'run_created':
      return 0;
    case 'topic_resolved':
      return 1;
    case 'brand_loaded':
    case 'template_loaded':
      return 2;
    case 'content_generated':
      return 3;
    case 'render_started':
    case 'slide_rendered':
      return 4;
    case 'render_complete':
    case 'enqueued':
    case 'awaiting_approval':
    case 'complete':
    case 'result':
    case 'done':
      return 5;
    default:
      return state.status === 'connecting' ? 0 : 0;
  }
}

/** The human-readable "what's happening right now" line. */
function reasoningLine(state: PipelineStreamState): string {
  if (state.status === 'connecting') return 'Reaching the engine…';
  switch (state.phase) {
    case 'started':
    case 'run_created':
      return 'Igniting the pipeline…';
    case 'topic_resolved':
      return `Framing "${state.topic ?? 'your topic'}"`;
    case 'brand_loaded':
      return `Loading ${state.brandName ?? 'your'} brand voice…`;
    case 'template_loaded':
      return 'Choosing the layout…';
    case 'content_generated':
      return `Wrote ${state.content?.slideCount ?? ''} slides — ${state.content?.hook ?? 'hook ready'}`;
    case 'render_started':
      return 'Rendering slides…';
    case 'slide_rendered': {
      const n = state.slides.length;
      const total = state.totalSlides || n;
      const role = state.content?.slides?.find((s) => s.index === n - 1)?.role;
      return `Rendering slide ${n}/${total}${role ? ` (${role})` : ''}`;
    }
    case 'render_complete':
      return 'Polishing the set…';
    case 'complete':
    case 'result':
    case 'done':
      return 'Carousel forged.';
    case 'awaiting_approval':
      return 'Ready for your review.';
    case 'error':
      return state.error ?? 'Something went wrong.';
    default:
      return 'Working…';
  }
}

export function ReasoningTrack({ state }: { state: PipelineStreamState }) {
  const active = stageIndex(state);
  const isError = state.status === 'error';
  const isDone = state.status === 'complete';

  return (
    <div className="space-y-3">
      {/* reasoning line */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'inline-flex h-2 w-2 shrink-0 rounded-full',
            isError
              ? 'bg-state-danger'
              : isDone
                ? 'bg-state-success'
                : 'bg-flux-violet shadow-[0_0_10px_2px_rgba(139,92,246,0.7)] animate-pulse',
          )}
        />
        <span
          className={cn(
            'font-mono text-[13px]',
            isError ? 'text-state-danger' : isDone ? 'text-state-success' : 'text-fg',
          )}
        >
          {reasoningLine(state)}
        </span>
      </div>

      {/* segmented track */}
      <div className="flex gap-1.5">
        {STAGES.map((stage, i) => {
          const reached = active >= i || isDone;
          const current = active === i && !isDone && !isError;
          return (
            <div key={stage.key} className="flex-1">
              <div
                className={cn(
                  'h-1 overflow-hidden rounded-full bg-surface-2',
                  reached && 'bg-flux-cyan/30',
                )}
              >
                {current ? (
                  <div className="h-full w-full bg-flux-gradient shimmer-sweep" />
                ) : reached ? (
                  <div className="h-full w-full bg-flux-gradient" />
                ) : null}
              </div>
              <div
                className={cn(
                  'mt-1.5 hidden text-[9px] font-semibold uppercase tracking-[0.1em] sm:block',
                  current ? 'text-flux-cyan' : reached ? 'text-fg-muted' : 'text-fg-dim',
                )}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
