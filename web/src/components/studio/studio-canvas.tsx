'use client';

/**
 * Studio canvas — center column of the studio surface.
 *
 * Phase 2 (post-audit #1): now consumes a live SSE stream from the engine.
 * Slides materialize as PNGs land in storage — first slide typically arrives
 * ~2-3s after submit instead of waiting 30s for the whole pipeline.
 *
 *   - Topic input + "Ship a carousel" button kicks off /api/pipeline/stream
 *   - During generation: a phase timeline (topic → brand → content → render)
 *     shows what the engine is doing right now
 *   - As each slide_rendered event arrives, its preview tile slides in with
 *     a fade-up animation. Placeholders shimmer for slides not yet rendered.
 *   - On complete: the canvas freezes the result and offers "Open in detail"
 *
 * Aesthetic: layered glass, gradient ring around active row, cinematic
 * scroll-snap behavior for the slide preview row.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  usePipelineStream,
  type PipelineEventType,
} from '@/lib/use-pipeline-stream';

interface RecentCarousel {
  id: string;
  title: string | null;
  hook: string | null;
  status: string;
  slide_count: number;
  slides?: Array<{ imageUrl?: string; role?: string }>;
  created_at: string;
}

const PHASES: Array<{ key: PipelineEventType; label: string }> = [
  { key: 'started', label: 'Booting pipeline' },
  { key: 'topic_resolved', label: 'Topic locked in' },
  { key: 'brand_loaded', label: 'Brand voice loaded' },
  { key: 'content_generated', label: 'Script + slides written' },
  { key: 'render_started', label: 'Rendering slides' },
  { key: 'render_complete', label: 'Slides rendered' },
  { key: 'complete', label: 'Done' },
];

function phaseIndex(phase: PipelineEventType | null): number {
  if (!phase) return -1;
  const i = PHASES.findIndex((p) => p.key === phase);
  if (i !== -1) return i;
  // Some events like slide_rendered live "inside" render_started
  if (phase === 'slide_rendered') return PHASES.findIndex((p) => p.key === 'render_started');
  if (phase === 'awaiting_approval' || phase === 'enqueued' || phase === 'result' || phase === 'done')
    return PHASES.length - 1;
  return -1;
}

export function StudioCanvas({
  defaultTopic = '',
  selectedThemeKey,
  recent,
}: {
  defaultTopic?: string;
  selectedThemeKey?: string | null;
  recent: RecentCarousel[];
}) {
  const router = useRouter();
  const [topic, setTopic] = useState(defaultTopic);
  const { state, start, reset } = usePipelineStream();

  const pending = state.status === 'connecting' || state.status === 'running';
  const showcase = !pending && state.status === 'idle' ? recent[0] : null;
  const activePhase = phaseIndex(state.phase);

  // Auto-route on completion (matches the old behaviour the user expects).
  useEffect(() => {
    if (state.status === 'complete' && state.carouselId) {
      const t = setTimeout(() => router.push(`/carousels/${state.carouselId}`), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.status, state.carouselId, router]);

  const submit = () => {
    if (!topic.trim()) return;
    void start({
      topic: topic.trim(),
      styleModeKey: selectedThemeKey ?? undefined,
    });
  };

  // Build the slide tile list: known slides from the stream, padded with
  // placeholders up to totalSlides so the layout doesn't jump.
  const slideTotal = Math.max(
    state.totalSlides,
    state.content?.slideCount ?? 0,
    state.slides.length,
  );
  const slideTiles = Array.from({ length: slideTotal || 0 }).map((_, i) => {
    const rendered = state.slides.find((s) => s.index === i);
    const scripted = state.content?.slides?.find((s) => s.index === i);
    return { index: i, rendered, scripted };
  });

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Topic + generate */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-5"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at top left, rgba(167,139,250,0.10), transparent 60%), radial-gradient(ellipse at bottom right, rgba(34,211,238,0.06), transparent 50%)',
        }}
      >
        <label
          htmlFor="studio-topic"
          className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
        >
          Drop your topic
        </label>
        <textarea
          id="studio-topic"
          rows={2}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          placeholder="e.g. Why most SMBs lose 30% of leads to slow replies"
          className="mt-2 w-full resize-none bg-transparent text-lg font-medium leading-tight text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-xl"
          disabled={pending}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {selectedThemeKey ? (
              <span>
                Style:{' '}
                <span className="font-semibold text-foreground">{selectedThemeKey}</span>
              </span>
            ) : (
              <span>No style picked — default theme will be used</span>
            )}
            <span className="mx-2 text-border">·</span>
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold">
              ⌘↵
            </kbd>{' '}
            to ship
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !topic.trim()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-background transition disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #A78BFA 0%, #22D3EE 50%, #EC4899 100%)',
              boxShadow: '0 12px 36px -8px rgba(34,211,238,0.5)',
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {pending ? 'Producing live…' : 'Ship a carousel'}
          </button>
        </div>
      </div>

      {/* Canvas — live stream OR latest showcase */}
      <div
        className="relative flex-1 overflow-hidden rounded-2xl border border-border/40 bg-card/30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(167,139,250,0.06), transparent 60%)',
        }}
      >
        {pending || state.status === 'complete' || state.status === 'error' ? (
          <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
            {/* Phase strip */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {PHASES.map((p, i) => {
                const reached = activePhase >= i || state.status === 'complete';
                const active = activePhase === i && pending;
                return (
                  <div
                    key={p.key}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${
                      active
                        ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                        : reached
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-card/40 text-muted-foreground/60'
                    }`}
                  >
                    {active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : reached ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-muted-foreground/30" />
                    )}
                    {p.label}
                  </div>
                );
              })}
            </div>

            {/* Live content header */}
            {(state.content?.hook || state.content?.title || state.topic) && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {state.brandName ? `${state.brandName} ·` : ''} Producing now
                </div>
                <div className="mt-1 text-base font-semibold leading-tight">
                  {state.content?.title ?? state.content?.hook ?? state.topic}
                </div>
                {state.content?.hook && state.content.hook !== state.content.title && (
                  <div className="mt-1 text-xs text-muted-foreground">{state.content.hook}</div>
                )}
              </div>
            )}

            {/* Slide preview row — placeholders shimmer, real ones fade in */}
            <div className="flex flex-1 gap-3 overflow-x-auto pb-2 scroll-hide">
              {slideTiles.length === 0 ? (
                <div className="flex w-full items-center justify-center">
                  <div className="relative">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/40" />
                    <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                  </div>
                </div>
              ) : (
                slideTiles.map((tile) => (
                  <SlideTile key={tile.index} tile={tile} />
                ))
              )}
            </div>

            {/* Footer status / error */}
            {state.status === 'error' && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {state.error}
              </div>
            )}
            {state.status === 'complete' && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <span>
                  Done — {state.slides.length} slide{state.slides.length === 1 ? '' : 's'} rendered.
                  Opening detail view…
                </span>
                <button
                  type="button"
                  className="text-emerald-200 underline-offset-2 hover:underline"
                  onClick={reset}
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        ) : showcase && showcase.slides && showcase.slides.length > 0 ? (
          <div className="h-full p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Latest production
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {showcase.title ?? showcase.hook ?? 'Untitled'}
                </div>
              </div>
              <Link
                href={`/carousels/${showcase.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Review <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scroll-hide">
              {showcase.slides.slice(0, 6).map((s, i) => (
                <div
                  key={i}
                  className="aspect-square w-[200px] shrink-0 overflow-hidden rounded-xl border border-border/40 bg-secondary/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
                >
                  {s.imageUrl ? (
                    <Image
                      src={s.imageUrl}
                      alt={`Slide ${i + 1}`}
                      width={200}
                      height={200}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-flux-gradient text-background">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold">Your studio is ready.</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Drop a topic above. Pick a style on the right. Hit{' '}
              <span className="text-foreground">Ship a carousel</span>. Slides materialize as
              they&apos;re rendered — no waiting for the whole pipeline.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-semibold">
                ⌘K
              </kbd>
              for the command palette
              <span className="mx-1 text-border">·</span>
              tap a style tile to apply
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SlideTile({
  tile,
}: {
  tile: {
    index: number;
    rendered?: { publicUrl: string; index: number };
    scripted?: { layout: string; role: string };
  };
}) {
  return (
    <div
      className={`relative aspect-square w-[200px] shrink-0 overflow-hidden rounded-xl border border-border/40 bg-secondary/40 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] transition ${
        tile.rendered ? 'animate-fade-up' : ''
      }`}
    >
      {tile.rendered ? (
        <Image
          src={tile.rendered.publicUrl}
          alt={`Slide ${tile.index + 1}`}
          width={200}
          height={200}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center">
          <div
            className="absolute inset-0 animate-pulse opacity-40"
            style={{
              background:
                'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(34,211,238,0.10) 100%)',
            }}
          />
          <div className="relative z-10 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin text-primary" />
            Slide {tile.index + 1}
            {tile.scripted && (
              <div className="mt-1 text-[9px] opacity-70">{tile.scripted.role}</div>
            )}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
        {tile.index + 1}
      </div>
    </div>
  );
}
