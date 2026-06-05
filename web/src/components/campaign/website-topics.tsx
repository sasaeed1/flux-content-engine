'use client';

/**
 * WebsiteTopics — paste a URL, Flux reads the site and proposes on-brand topics
 * (POST /tenant/topics/from-website), then refreshes the calendar.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Sparkles } from 'lucide-react';
import { generateFromWebsiteAction } from '@/app/(app)/campaign/actions';

export function WebsiteTopics() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const run = () => {
    if (!url.trim() || pending) return;
    setMsg(null);
    start(async () => {
      try {
        const res = await generateFromWebsiteAction(url.trim(), 8);
        setMsg({ kind: 'ok', text: `Added ${res.inserted} on-brand topics from your site.` });
        setUrl('');
        router.refresh();
      } catch (e) {
        setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to analyze that URL.' });
      }
    });
  };

  return (
    <div className="solid-card space-y-3 rounded-lg p-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-flux-cyan" />
        <h3 className="text-label text-fg-muted">Topics from your website</h3>
      </div>
      <p className="text-[11px] text-fg-dim">
        Paste your site — Flux reads it and proposes on-brand topics.
      </p>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
          placeholder="https://yourbrand.com"
          className="min-w-0 flex-1 rounded-lg border border-edge-subtle bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-flux-cyan/50"
        />
        <button
          type="button"
          onClick={run}
          disabled={pending || !url.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-flux-gradient px-3 py-2 text-sm font-semibold text-flux-ink glow-cta transition disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Analyze
        </button>
      </div>
      {msg && (
        <div className={`text-[11px] ${msg.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
