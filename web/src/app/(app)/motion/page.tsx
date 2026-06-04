import Link from 'next/link';
import { Film } from 'lucide-react';
import { api } from '@/lib/api-client';
import type { ReelRow } from '@/lib/types';
import { fmtRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function MotionPage() {
  let reels: ReelRow[] = [];
  try {
    ({ reels } = await api.reels.list());
  } catch {
    /* generated_reels table may not exist until the migration is applied */
  }

  let carousels: Awaited<ReturnType<typeof api.listCarousels>>['carousels'] = [];
  try {
    ({ carousels } = await api.listCarousels(24));
  } catch {
    /* ignore */
  }

  return (
    <div className="min-w-0 space-y-8">
      <header className="space-y-2">
        <p className="text-label text-fg-dim">Motion Studio</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          <span className="gradient-text">Cinematic reels</span>
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          Turn any carousel into a zero-cost cinematic reel — Ken Burns motion, transitions, and
          film grain, rendered locally with ffmpeg. Open a carousel to generate one.
        </p>
      </header>

      {reels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-label text-fg-muted">Your reels</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {reels.map((r) => (
              <ReelTile key={r.id} reel={r} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-label text-fg-muted">Animate a carousel</h2>
        {carousels.length === 0 ? (
          <div className="solid-card rounded-lg p-6 text-sm text-fg-muted">
            No carousels yet. Create one in the{' '}
            <Link href="/forge" className="text-flux-cyan hover:underline">
              Forge
            </Link>
            , then come back to animate it.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {carousels.map((c) => {
              const thumb = c.slides?.[0]?.imageUrl;
              return (
                <Link
                  key={c.id}
                  href={`/library/${c.id}`}
                  className="group solid-card overflow-hidden rounded-lg transition hover:border-flux-cyan/40"
                >
                  <div className="relative aspect-[4/5] bg-surface-2">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-fg-dim">
                        <Film className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-flux-gradient px-2.5 py-1 text-xs font-semibold text-flux-ink">
                        <Film className="h-3.5 w-3.5" /> Animate
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <div className="truncate text-xs font-semibold text-fg">
                      {c.title ?? 'Untitled carousel'}
                    </div>
                    <div className="text-[10px] text-fg-dim">{fmtRelative(c.created_at)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ReelTile({ reel }: { reel: ReelRow }) {
  if (reel.status !== 'ready' || !reel.public_url) {
    return (
      <div className="grid aspect-[9/16] place-items-center rounded-lg border border-edge-subtle bg-surface-2/60 text-[10px] text-fg-dim">
        {reel.status === 'processing' ? 'Rendering…' : 'Unavailable'}
      </div>
    );
  }
  return (
    <video
      src={reel.public_url}
      controls
      playsInline
      preload="metadata"
      className="aspect-[9/16] w-full rounded-lg border border-edge-subtle bg-black object-cover"
    />
  );
}
