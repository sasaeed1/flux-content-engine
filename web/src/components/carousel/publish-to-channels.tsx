'use client';

/**
 * PublishToChannels — pick connected social channels and cross-post this
 * carousel to all of them. Routes through /tenant/carousels/:id/publish-to,
 * which fans out to each platform's publisher. Shows a per-channel result.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { publishToChannelsAction } from '@/app/(app)/settings/actions';
import type { PublishOutcome, SocialConnectionPublic, SocialPlatform } from '@/lib/types';

const PLATFORM_NAME: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};
const PLATFORM_ACCENT: Record<SocialPlatform, string> = {
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  tiktok: '#FE2C55',
};

export function PublishToChannels({
  carouselId,
  connections,
}: {
  carouselId: string;
  connections: SocialConnectionPublic[];
}) {
  const usable = connections.filter((c) => c.status === 'connected');
  const [selected, setSelected] = useState<string[]>(usable.map((c) => c.id));
  const [pending, start] = useTransition();
  const [results, setResults] = useState<PublishOutcome[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const publish = () => {
    if (selected.length === 0) return;
    setErr(null);
    setResults(null);
    start(async () => {
      try {
        const res = await publishToChannelsAction(carouselId, selected);
        setResults(res.results);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Publish failed.');
      }
    });
  };

  if (usable.length === 0) {
    return (
      <div className="solid-card rounded-lg p-4 text-[13px] text-fg-muted">
        <span className="font-semibold text-fg">Cross-post everywhere.</span> Publish this carousel
        to LinkedIn, TikTok, and Instagram —{' '}
        <Link href="/settings#channels" className="text-flux-cyan hover:underline">
          connect a channel
        </Link>{' '}
        to get started.
      </div>
    );
  }

  return (
    <div className="solid-card space-y-3 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-flux-cyan" />
        <h3 className="text-label text-fg-muted">Publish to channels</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {usable.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`press inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[13px] transition ${
                on
                  ? 'border-transparent text-white'
                  : 'border-edge-strong bg-surface-1 text-fg-muted hover:text-fg'
              }`}
              style={on ? { background: PLATFORM_ACCENT[c.platform] } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: on ? '#fff' : PLATFORM_ACCENT[c.platform] }}
              />
              {PLATFORM_NAME[c.platform]}
              {c.displayName ? <span className="opacity-80">· {c.displayName}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={pending || selected.length === 0}
          className="press inline-flex items-center gap-2 rounded-sm bg-flux-gradient px-4 py-2 text-[13px] font-bold text-flux-ink glow-cta disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publish to {selected.length} {selected.length === 1 ? 'channel' : 'channels'}
        </button>
      </div>

      {err && <div className="text-[12px] text-red-300">{err}</div>}

      {results && (
        <ul className="space-y-1.5 border-t border-edge-subtle pt-3">
          {results.map((r) => (
            <li key={r.connectionId} className="flex items-start gap-2 text-[13px]">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-medium">{PLATFORM_NAME[r.platform]}</span>{' '}
                {r.ok ? (
                  <>
                    published
                    {r.permalink && (
                      <>
                        {' — '}
                        <a
                          href={r.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-flux-cyan hover:underline"
                        >
                          view
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-fg-dim">{r.error}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
