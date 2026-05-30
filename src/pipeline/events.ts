/**
 * Pipeline streaming events.
 *
 * The pipeline orchestrator emits these into an optional `PipelineEventSink`.
 * They drive the Studio's live "slides materialize as they're produced"
 * experience without changing the underlying generation flow.
 *
 * The sink contract is fire-and-forget: a slow consumer must NEVER block
 * the pipeline. The route adapter that writes SSE chunks wraps sink calls
 * in setImmediate so backpressure on the HTTP socket can't stall the
 * generation step.
 */
import type { RenderedSlide } from '../types';

export type PipelineEventType =
  | 'started'
  | 'run_created'
  | 'topic_resolved'
  | 'brand_loaded'
  | 'template_loaded'
  | 'content_generated'
  | 'persisted'
  | 'render_started'
  | 'slide_rendered'
  | 'render_complete'
  | 'enqueued'
  | 'awaiting_approval'
  | 'complete'
  | 'error';

export interface PipelineEvent {
  type: PipelineEventType;
  /** Server time when the event was emitted. */
  at: string;
  /** Run ID, populated as soon as the run row exists. */
  runId?: string;
  /** Free-form payload — every type defines its own shape. */
  payload?: Record<string, unknown>;
}

/**
 * Sink callback. Implementations can write SSE chunks, push to a WebSocket,
 * accumulate in memory, or no-op. Errors thrown here are swallowed by the
 * pipeline (we don't want a flaky socket to abort generation).
 */
export type PipelineEventSink = (event: PipelineEvent) => void;

/**
 * Lightweight per-slide rendered event payload — the renderer reports
 * this as each slide PNG lands in storage so the Studio can swap a
 * placeholder for the real image.
 */
export interface SlideRenderedPayload {
  slideIndex: number;
  totalSlides: number;
  publicUrl: string;
  storagePath: string;
  width: number;
  height: number;
  bytes: number;
}

export function slideRenderedPayload(r: RenderedSlide, total: number): SlideRenderedPayload {
  return {
    slideIndex: r.slideIndex,
    totalSlides: total,
    publicUrl: r.publicUrl,
    storagePath: r.storagePath,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
  };
}

/**
 * Safe emitter — never throws, never blocks. Use this everywhere the
 * pipeline wants to emit so we don't need try/catch at every call site.
 */
export function emit(
  sink: PipelineEventSink | undefined | null,
  type: PipelineEventType,
  payload?: Record<string, unknown>,
  runId?: string,
): void {
  if (!sink) return;
  try {
    sink({ type, at: new Date().toISOString(), runId, payload });
  } catch {
    /* sink errors must not affect the pipeline */
  }
}
