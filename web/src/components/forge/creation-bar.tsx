'use client';

/**
 * CreationBar — the commanding creation surface (Perplexity-style).
 *
 * Bottom-docked in the Forge chamber. As you type, Flux proposes hook angles
 * inline (ambient — not a button you press) and a violet thinking-shimmer runs
 * along the bar while it reasons. A horizontal style strip sits above with a
 * gold "recommended" marker; spark chips offer one-tap seeds when empty.
 * Cmd/Ctrl+Enter ignites.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, Sparkles, Wand2, Zap } from 'lucide-react';
import type { StyleMode } from '@/components/flux/style-tile';
import { copilotHooksAction } from '@/app/(app)/copilot-actions';
import { cn } from '@/lib/utils';

function gradOf(style: StyleMode): string {
  const p = style.palette as Record<string, string | string[]>;
  const g = p.gradient;
  if (Array.isArray(g) && g.length >= 2) return `linear-gradient(135deg, ${g.join(', ')})`;
  const bg = (p.background as string) ?? '#10131D';
  const accent = (p.accent as string) ?? '#22D3EE';
  return `linear-gradient(135deg, ${bg}, ${accent})`;
}

export function CreationBar({
  topic,
  setTopic,
  styles,
  selectedKey,
  setSelectedKey,
  recommendedKey,
  sparks,
  busy,
  onIgnite,
}: {
  topic: string;
  setTopic: (v: string) => void;
  styles: StyleMode[];
  selectedKey: string | null;
  setSelectedKey: (k: string) => void;
  recommendedKey: string | null;
  sparks: string[];
  busy: boolean;
  onIgnite: () => void;
}) {
  const [angles, setAngles] = useState<string[]>([]);
  const [thinking, startThinking] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueried = useRef('');

  // Ambient angle suggestions — when the user pauses on a meaty topic.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const t = topic.trim();
    if (t.length < 16 || t === lastQueried.current || busy) {
      if (t.length < 16) setAngles([]);
      return;
    }
    debounce.current = setTimeout(() => {
      lastQueried.current = t;
      startThinking(async () => {
        try {
          const res = await copilotHooksAction(t, 3);
          setAngles(res.hooks.map((h) => h.text).slice(0, 3));
        } catch {
          /* ignore */
        }
      });
    }, 850);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [topic, busy]);

  return (
    <div className="space-y-3">
      {/* angle suggestions (ambient) */}
      {(angles.length > 0 || thinking) && !busy && (
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-flux-violet-bright">
            <Sparkles className="h-3 w-3" />
            {thinking ? 'Finding angles' : 'Try'}
          </span>
          {thinking && angles.length === 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-flux-violet-bright" />
          ) : (
            <div className="flex flex-1 gap-2 overflow-x-auto scroll-hide">
              {angles.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTopic(a)}
                  className="press shrink-0 animate-fade-up rounded-pill border border-flux-violet/25 bg-flux-violet/[0.07] px-3 py-1 text-[12px] text-fg-muted transition hover:border-flux-violet/50 hover:text-fg"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {a.length > 52 ? a.slice(0, 52) + '…' : a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* style strip */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-dim">
          Style
        </span>
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1 scroll-hide">
          {styles.map((s) => {
            const active = s.key === selectedKey;
            const rec = s.key === recommendedKey;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelectedKey(s.key)}
                title={s.name}
                className={cn(
                  'press group relative flex shrink-0 items-center gap-1.5 rounded-pill border py-1 pl-1 pr-2.5 text-[12px] transition',
                  active
                    ? 'border-flux-cyan/50 bg-surface-2 text-fg ring-1 ring-flux-cyan/30'
                    : 'border-edge-subtle bg-surface-1 text-fg-muted hover:border-edge-strong hover:text-fg',
                )}
              >
                <span
                  className="h-4 w-4 rounded-full ring-1 ring-white/10"
                  style={{ background: gradOf(s) }}
                />
                <span className="whitespace-nowrap">{s.name}</span>
                {rec && <span className="h-1.5 w-1.5 rounded-full bg-flux-gold shadow-[0_0_8px_var(--gold)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* the bar */}
      <div
        className={cn(
          'relative flex items-end gap-2 rounded-xl border bg-surface-1 p-2.5 transition',
          thinking ? 'border-flux-violet/40 shimmer-sweep' : 'border-edge-strong focus-within:glow-primary',
        )}
      >
        <Wand2 className="mb-2.5 ml-1.5 h-5 w-5 shrink-0 text-flux-violet-bright" />
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onIgnite();
            }
          }}
          rows={1}
          disabled={busy}
          placeholder="What do you want to create?"
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-base text-fg outline-none placeholder:text-fg-dim sm:text-lg"
        />
        <button
          type="button"
          onClick={onIgnite}
          disabled={busy || !topic.trim()}
          className="press inline-flex h-11 items-center gap-2 rounded-sm bg-flux-gradient bg-[length:200%_200%] px-5 text-sm font-bold text-flux-ink glow-cta transition-[background-position] duration-500 hover:bg-[position:100%_50%] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Forge
          <kbd className="hidden rounded border border-black/20 bg-black/10 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘↵
          </kbd>
        </button>
      </div>

      {/* spark chips when empty */}
      {!topic.trim() && sparks.length > 0 && !busy && (
        <div className="flex flex-wrap gap-2 px-1">
          {sparks.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTopic(s)}
              className="press animate-fade-up rounded-pill border border-edge-strong bg-surface-1 px-3 py-1.5 text-[12.5px] text-fg-muted transition hover:border-flux-violet/45 hover:text-fg"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              {s.length > 46 ? s.slice(0, 46) + '…' : s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
