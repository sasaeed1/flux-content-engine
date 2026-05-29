'use client';

/**
 * Studio canvas — center column of the studio surface.
 *
 * Top: the active topic + generate button.
 * Middle: a deep-glass "stage" where slide previews materialize one by one
 * as the pipeline produces them. Skeleton shimmer while generating.
 * Bottom: status + lightweight log.
 *
 * Aesthetic: layered glass, gradient ring around active row, cinematic
 * scroll-snap behavior for the slide preview row.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Loader2,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { generateFromStudioAction } from '@/app/(app)/studio/actions';

interface RecentRun {
  id: string;
  status: string;
  current_step: string | null;
  started_at: string;
  metadata?: Record<string, unknown> | null;
}

interface RecentCarousel {
  id: string;
  title: string | null;
  hook: string | null;
  status: string;
  slide_count: number;
  slides?: Array<{ imageUrl?: string; role?: string }>;
  created_at: string;
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
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    runId?: string;
    carouselId?: string;
    imageUrls?: string[];
  } | null>(null);

  const submit = () => {
    if (!topic.trim()) return;
    setFeedback(null);
    start(async () => {
      try {
        const res = await generateFromStudioAction({
          topic: topic.trim(),
          themeKey: selectedThemeKey ?? null,
        });
        setLastResult(res);
        if (res.carouselId) {
          setFeedback('Carousel produced — opening it…');
          setTimeout(() => router.push(`/carousels/${res.carouselId}`), 800);
        } else {
          setFeedback('Pipeline started. Check the library.');
        }
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : 'Generation failed.');
      }
    });
  };

  // Show the most recent carousel as the "canvas" backdrop when no active
  // generation is in flight.
  const showcase = !pending && !lastResult ? recent[0] : null;

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
                <span className="font-semibold text-foreground">
                  {selectedThemeKey}
                </span>
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
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {pending ? 'Producing…' : 'Ship a carousel'}
          </button>
        </div>
      </div>

      {/* Canvas — generation in progress OR latest showcase */}
      <div
        className="relative flex-1 overflow-hidden rounded-2xl border border-border/40 bg-card/30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(167,139,250,0.06), transparent 60%)',
        }}
      >
        {pending && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/40" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">Producing your carousel</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Routing across providers · researching · scripting · rendering
              </div>
            </div>
          </div>
        )}

        {showcase && showcase.slides && showcase.slides.length > 0 ? (
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
          !pending && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-flux-gradient text-background">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold">
                Your studio is ready.
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Drop a topic above. Pick a style on the right. Hit{' '}
                <span className="text-foreground">Ship a carousel</span>. Flux
                routes the work across your 5 connected providers, scripts the
                slides, and queues the result for review.
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
          )
        )}
      </div>

      {feedback && (
        <div
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-100"
        >
          <RefreshCw className="h-3.5 w-3.5" /> {feedback}
        </div>
      )}
    </div>
  );
}
