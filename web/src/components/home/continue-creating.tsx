'use client';

/**
 * ContinueCreating — the resumable-work rail.
 *
 * Horizontally-scrolling cinematic thumbnails of in-progress / draft carousels
 * so abandoned work is never lost (the audit's orphaned-work gap). Each card
 * picks up where you left off in the carousel detail. Stagger-reveals on mount.
 */
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Clock3, ImageIcon } from 'lucide-react';

export interface ResumableCarousel {
  id: string;
  title: string | null;
  hook: string | null;
  status: string;
  slide_count: number;
  cover: string | null;
  created_at: string;
}

function statusTone(status: string): string {
  switch (status) {
    case 'ready':
      return 'text-flux-cyan';
    case 'approved':
    case 'scheduled':
      return 'text-flux-magenta';
    case 'published':
      return 'text-state-success';
    default:
      return 'text-flux-violet-bright';
  }
}

export function ContinueCreating({ items }: { items: ResumableCarousel[] }) {
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-fg-muted" />
          <h2 className="font-display text-base font-semibold tracking-tight">Continue creating</h2>
        </div>
        <Link
          href="/library"
          className="press inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim transition hover:text-fg"
        >
          All work <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scroll-hide">
        {items.map((c, i) => (
          <Link
            key={c.id}
            href={`/library/${c.id}`}
            className="press group relative w-[210px] shrink-0 animate-fade-up overflow-hidden rounded-lg border border-edge-subtle bg-surface-1 transition hover:border-edge-strong"
            style={{ animationDelay: `${Math.min(i, 10) * 55}ms` }}
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
              {c.cover ? (
                <Image
                  src={c.cover}
                  alt={c.title ?? 'Carousel'}
                  width={210}
                  height={158}
                  unoptimized
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-fg-dim" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />
              <span
                className={`absolute bottom-2 left-2 rounded-pill bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur ${statusTone(c.status)}`}
              >
                {c.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="p-3">
              <div className="truncate text-[13px] font-semibold text-fg">
                {c.title ?? c.hook ?? 'Untitled carousel'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-fg-dim">
                <span>{c.slide_count} slides</span>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1 text-flux-cyan opacity-0 transition-opacity group-hover:opacity-100">
                  Resume <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
