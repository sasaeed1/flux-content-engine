'use client';

/**
 * ReelStudio — turn a carousel into a cinematic MP4 reel.
 *
 * Pick an aspect + motion preset, hit generate. The engine renders the reel
 * in the background (zero API cost, ~1 min); this component polls until the
 * row flips to `ready`, then shows the <video>. Sits in the carousel detail
 * page and powers the Motion workspace.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Film, Loader2, Sparkles } from 'lucide-react';
import { generateReelAction, getReelAction } from '@/app/(app)/carousels/[id]/reel-actions';
import type { ReelRow } from '@/lib/types';

const ASPECTS = [
  { key: 'reel', label: '9:16', hint: 'Reels / TikTok' },
  { key: 'square', label: '1:1', hint: 'Feed' },
  { key: 'portrait', label: '4:5', hint: 'Feed (tall)' },
];

const PRESETS = [
  { key: 'cinematic', label: 'Cinematic' },
  { key: 'subtle', label: 'Subtle' },
  { key: 'dynamic', label: 'Dynamic' },
  { key: 'kinetic', label: 'Kinetic' },
  { key: 'still', label: 'Still' },
];

function chip(active: boolean) {
  return `rounded-md border px-2.5 py-1 text-xs font-medium transition ${
    active
      ? 'border-flux-cyan/50 bg-flux-cyan/15 text-flux-cyan'
      : 'border-edge-subtle text-fg-muted hover:bg-surface-2'
  }`;
}

export function ReelStudio({
  carouselId,
  initialReels,
}: {
  carouselId: string;
  initialReels: ReelRow[];
}) {
  const router = useRouter();
  const [reels, setReels] = useState<ReelRow[]>(initialReels);
  const [aspect, setAspect] = useState('reel');
  const [presetKey, setPresetKey] = useState('cinematic');
  const [kinetic, setKinetic] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processing = reels.find((r) => r.status === 'processing');

  // Poll while a reel is rendering; stop + refresh once it lands.
  useEffect(() => {
    if (!processing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return; // already polling

    pollRef.current = setInterval(async () => {
      try {
        const updated = await getReelAction(processing.id);
        setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        if (updated.status !== 'processing') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          router.refresh();
        }
      } catch {
        /* transient — keep polling */
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [processing, router]);

  const generate = () => {
    setErr(null);
    start(async () => {
      try {
        const reel = await generateReelAction(carouselId, aspect, presetKey, kinetic);
        setReels((prev) => [reel, ...prev]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Reel generation failed.');
      }
    });
  };

  const busy = pending || !!processing;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 text-flux-cyan" />
        <h2 className="text-label text-fg-muted">Motion reel</h2>
      </div>

      <div className="solid-card space-y-4 rounded-lg p-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim">Aspect</div>
          <div className="flex flex-wrap gap-1.5">
            {ASPECTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAspect(a.key)}
                className={chip(aspect === a.key)}
                title={a.hint}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim">Motion</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetKey(p.key)}
                className={chip(presetKey === p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={kinetic}
          onClick={() => setKinetic((v) => !v)}
          className="flex w-full items-center gap-2.5 text-left"
        >
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${
              kinetic ? 'bg-flux-cyan' : 'border border-edge-subtle bg-surface-2'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                kinetic ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </span>
          <span className="text-xs text-fg-muted">
            Kinetic hook intro <span className="text-fg-dim">· animated text, slower</span>
          </span>
        </button>

        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-flux-gradient px-4 py-2.5 text-sm font-semibold text-flux-ink glow-cta transition disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {processing ? 'Rendering reel…' : pending ? 'Starting…' : 'Generate cinematic reel'}
        </button>

        {err && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {err}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-fg-dim">
          Zero-cost render — your slides become a cinematic MP4 (Ken Burns motion, transitions,
          film grain). Takes ~1 minute.
        </p>
      </div>

      {reels.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {reels.map((r) => (
            <ReelCard key={r.id} reel={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReelCard({ reel }: { reel: ReelRow }) {
  if (reel.status === 'processing') {
    return (
      <div className="grid aspect-[9/16] animate-pulse place-items-center rounded-lg border border-edge-subtle bg-surface-2/60">
        <div className="flex flex-col items-center gap-2 text-fg-dim">
          <Loader2 className="h-5 w-5 animate-spin text-flux-violet-bright" />
          <span className="text-[10px]">Rendering…</span>
        </div>
      </div>
    );
  }
  if (reel.status === 'failed' || !reel.public_url) {
    return (
      <div className="grid aspect-[9/16] place-items-center rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-center">
        <span className="text-[10px] text-red-300">Render failed</span>
      </div>
    );
  }
  return (
    <div className="group relative overflow-hidden rounded-lg border border-edge-subtle bg-black">
      <video
        src={reel.public_url}
        controls
        playsInline
        preload="metadata"
        className="aspect-[9/16] w-full object-cover"
      />
      <a
        href={reel.public_url}
        download
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
        title="Download reel"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
