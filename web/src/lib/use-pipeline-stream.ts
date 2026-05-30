'use client';

/**
 * usePipelineStream — React hook that consumes the engine's SSE pipeline
 * stream and exposes typed event state to the Studio.
 *
 * The browser POSTs to /api/pipeline/stream (Next.js proxy → engine SSE).
 * As `slide_rendered` events arrive, the slides array grows and the canvas
 * materializes each preview in real time.
 *
 * Cancelling: calling reset() or unmounting aborts the fetch, which closes
 * the upstream socket; the engine's req.close handler stops emitting.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

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
  | 'error'
  | 'result'
  | 'done';

export interface PipelineEvent {
  type: PipelineEventType;
  at: string;
  runId?: string;
  payload?: Record<string, unknown>;
}

export interface SlidePreview {
  index: number;
  total: number;
  publicUrl: string;
  storagePath: string;
  width: number;
  height: number;
}

export interface ContentPreview {
  kind: 'carousel' | 'single';
  title?: string;
  hook?: string;
  cta?: string;
  caption?: string;
  slideCount: number;
  slides?: Array<{ index: number; role: string; layout: string; data: Record<string, unknown> }>;
}

export interface PipelineStreamState {
  status: 'idle' | 'connecting' | 'running' | 'complete' | 'error';
  /** Current pipeline phase, derived from the latest event type. */
  phase: PipelineEventType | null;
  runId: string | null;
  topic: string | null;
  hookArchetype: string | null;
  brandName: string | null;
  content: ContentPreview | null;
  slides: SlidePreview[];
  /** Estimated total slides, populated as soon as render_started fires. */
  totalSlides: number;
  carouselId: string | null;
  postId: string | null;
  imageUrls: string[];
  error: string | null;
  events: PipelineEvent[];
}

const INITIAL_STATE: PipelineStreamState = {
  status: 'idle',
  phase: null,
  runId: null,
  topic: null,
  hookArchetype: null,
  brandName: null,
  content: null,
  slides: [],
  totalSlides: 0,
  carouselId: null,
  postId: null,
  imageUrls: [],
  error: null,
  events: [],
};

export interface PipelineStreamRequest {
  topic?: string;
  topicId?: string;
  styleModeKey?: string;
  brandProfileId?: string;
  templateKey?: string;
  approvalMode?: 'auto' | 'manual';
}

/**
 * Parse a single SSE message block. Returns null when the block is empty or
 * only contains comments (lines starting with `:`).
 */
function parseSseBlock(block: string): PipelineEvent | null {
  const lines = block.split('\n');
  let event: string | null = null;
  let data: string | null = null;
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data = (data ?? '') + line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as PipelineEvent;
    // Engine emits both `event:` line AND `data.type` — keep them in sync.
    if (event && !parsed.type) parsed.type = event as PipelineEventType;
    return parsed;
  } catch {
    return null;
  }
}

export function usePipelineStream() {
  const [state, setState] = useState<PipelineStreamState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Tear down on unmount so a navigation while in-flight doesn't leak the socket.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const apply = useCallback((event: PipelineEvent) => {
    setState((prev) => {
      const next: PipelineStreamState = {
        ...prev,
        phase: event.type,
        events: [...prev.events, event].slice(-200),
      };
      if (event.runId && !next.runId) next.runId = event.runId;
      const p = (event.payload ?? {}) as Record<string, unknown>;
      switch (event.type) {
        case 'started':
        case 'run_created':
          next.status = 'running';
          break;
        case 'topic_resolved':
          next.topic = (p.topic as string) ?? next.topic;
          break;
        case 'brand_loaded':
          next.brandName = (p.brandName as string) ?? next.brandName;
          break;
        case 'content_generated':
          next.content = {
            kind: (p.kind as 'carousel' | 'single') ?? 'carousel',
            title: p.title as string | undefined,
            hook: p.hook as string | undefined,
            cta: p.cta as string | undefined,
            caption: p.caption as string | undefined,
            slideCount: (p.slideCount as number) ?? 0,
            slides: p.slides as ContentPreview['slides'] | undefined,
          };
          if (!next.totalSlides) next.totalSlides = (p.slideCount as number) ?? 0;
          break;
        case 'render_started':
          next.totalSlides = (p.totalSlides as number) ?? next.totalSlides;
          break;
        case 'slide_rendered': {
          const slide: SlidePreview = {
            index: (p.slideIndex as number) ?? 0,
            total: (p.totalSlides as number) ?? next.totalSlides,
            publicUrl: (p.publicUrl as string) ?? '',
            storagePath: (p.storagePath as string) ?? '',
            width: (p.width as number) ?? 1080,
            height: (p.height as number) ?? 1080,
          };
          // Upsert by index so a retry doesn't duplicate.
          const others = next.slides.filter((s) => s.index !== slide.index);
          next.slides = [...others, slide].sort((a, b) => a.index - b.index);
          next.totalSlides = slide.total || next.totalSlides;
          break;
        }
        case 'render_complete':
          next.imageUrls = (p.urls as string[]) ?? next.imageUrls;
          break;
        case 'awaiting_approval':
        case 'complete':
        case 'result':
          next.carouselId = (p.carouselId as string) ?? next.carouselId;
          next.postId = (p.postId as string) ?? next.postId;
          if (Array.isArray(p.imageUrls)) {
            next.imageUrls = p.imageUrls as string[];
          }
          if (event.type !== 'awaiting_approval') next.status = 'complete';
          break;
        case 'error':
          next.status = 'error';
          next.error = (p.message as string) ?? 'Pipeline failed.';
          break;
        case 'done':
          if (next.status === 'running') next.status = 'complete';
          break;
      }
      return next;
    });
  }, []);

  const start = useCallback(
    async (request: PipelineStreamRequest) => {
      // Any in-flight stream is cancelled before kicking off a new one.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setState({ ...INITIAL_STATE, status: 'connecting' });

      let res: Response;
      try {
        res = await fetch('/api/pipeline/stream', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
      } catch (err) {
        const message = (err as Error).message;
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, status: 'error', error: `Connect failed: ${message}` }));
        return;
      }

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        setState((s) => ({
          ...s,
          status: 'error',
          error: `Stream open failed (${res.status}): ${text.slice(0, 200)}`,
        }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE chunks are separated by a blank line. Split on \n\n.
          let idx = buffer.indexOf('\n\n');
          while (idx !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsed = parseSseBlock(block);
            if (parsed) apply(parsed);
            idx = buffer.indexOf('\n\n');
          }
        }
        // Flush any trailing block.
        if (buffer.trim()) {
          const parsed = parseSseBlock(buffer);
          if (parsed) apply(parsed);
        }
        // If the stream closes without an explicit `complete` we infer it.
        setState((s) =>
          s.status === 'running' || s.status === 'connecting'
            ? { ...s, status: 'complete' }
            : s,
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = (err as Error).message;
        setState((s) => ({ ...s, status: 'error', error: `Stream read failed: ${message}` }));
      }
    },
    [apply],
  );

  return { state, start, reset };
}
