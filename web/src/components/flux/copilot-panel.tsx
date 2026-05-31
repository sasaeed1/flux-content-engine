'use client';

/**
 * CopilotPanel — the omnipresent, context-aware AI companion.
 *
 * A summonable right drawer (toggle via the Topbar Bot button → COPILOT_EVENT,
 * or Cmd/Ctrl+J). It reacts to WHERE you are: on the Forge it coaches your
 * topic+style; on Library it suggests bulk moves + flags performers; on Brand
 * it offers a voice critique; elsewhere it surfaces opportunities. Folds in the
 * old studio-assistant's hook factory. Spring entrance + stagger-revealed
 * sections — the AI is never buried in a tab.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Fingerprint,
  Loader2,
  Send,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { COPILOT_EVENT } from '@/components/flux/copilot-trigger';
import { PresenceCards, type InsightCard } from '@/components/flux/presence-card';
import {
  copilotAskAction,
  copilotHooksAction,
  copilotInsightsAction,
} from '@/app/(app)/copilot-actions';
import { beginEngineTask } from '@/lib/use-engine-activity';
import { cn } from '@/lib/utils';

interface HookOut {
  text: string;
  archetype: string;
  score?: number;
}

/** Per-surface coaching copy. */
function contextFor(pathname: string): { title: string; blurb: string; surface: string } {
  if (pathname.startsWith('/forge') || pathname.startsWith('/studio'))
    return {
      title: 'Coaching your Forge',
      blurb: 'Drop a topic below and I’ll spin hook angles. Pick a style on the canvas and I’ll tell you if it fits.',
      surface: 'studio',
    };
  if (pathname.startsWith('/library') || pathname.startsWith('/carousels'))
    return {
      title: 'Reading your library',
      blurb: 'I can flag underperformers, suggest what to ship next, and spot styles that resonated.',
      surface: 'library',
    };
  if (pathname.startsWith('/brand') || pathname.startsWith('/themes'))
    return {
      title: 'Guarding your voice',
      blurb: 'Tell me a draft line and I’ll check it against your brand voice — tone, keywords, things to avoid.',
      surface: 'dashboard',
    };
  if (pathname.startsWith('/signals'))
    return {
      title: 'Explaining your signals',
      blurb: 'Ask me what’s working and why — I’ll read your performance memory and translate it.',
      surface: 'dashboard',
    };
  return {
    title: 'Your content copilot',
    blurb: 'Ask me anything, generate hooks, or jump to what matters. I’m watching your whole workspace.',
    surface: 'dashboard',
  };
}

export function CopilotPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ctx = contextFor(pathname);

  // ----- summon: custom event + Cmd/Ctrl+J + Escape -----
  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener(COPILOT_EVENT, onToggle);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(COPILOT_EVENT, onToggle);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // close on route change
  useEffect(() => setOpen(false), [pathname]);

  // ----- hook factory -----
  const [topic, setTopic] = useState('');
  const [hooks, setHooks] = useState<HookOut[]>([]);
  const [hooksPending, startHooks] = useTransition();

  const runHooks = () => {
    if (!topic.trim()) return;
    setHooks([]);
    const done = beginEngineTask('Spinning hooks');
    startHooks(async () => {
      try {
        const res = await copilotHooksAction(topic.trim(), 5);
        setHooks(res.hooks as HookOut[]);
      } catch {
        /* ignore */
      } finally {
        done();
      }
    });
  };

  // ----- contextual insights (lazy, on open) -----
  const [insights, setInsights] = useState<InsightCard[] | null>(null);
  useEffect(() => {
    if (!open || insights !== null) return;
    let alive = true;
    void copilotInsightsAction(ctx.surface).then((res) => {
      if (alive) setInsights(res as InsightCard[]);
    });
    return () => {
      alive = false;
    };
  }, [open, insights, ctx.surface]);

  // ----- ask -----
  const [ask, setAsk] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [askPending, startAsk] = useTransition();
  const askRef = useRef<HTMLInputElement>(null);

  const runAsk = () => {
    if (!ask.trim()) return;
    setReply(null);
    const done = beginEngineTask('Thinking');
    startAsk(async () => {
      try {
        const res = await copilotAskAction(ask.trim());
        setReply(res.reply);
      } catch {
        setReply('I hit a snag reaching the engine. Try again in a moment.');
      } finally {
        done();
      }
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          {/* drawer */}
          <motion.aside
            className="glass-frosted fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-edge-strong"
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 28, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-label="Copilot"
          >
            {/* header */}
            <div className="flex items-center justify-between gap-3 border-b border-edge-subtle px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-flux-violet/15 text-flux-violet-bright animate-pulse-think">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Copilot</div>
                  <div className="text-[11px] text-fg-muted">{ctx.title}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="hidden rounded border border-edge-strong bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-fg-dim sm:inline">
                  ⌘J
                </kbd>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="press rounded-sm p-1.5 text-fg-dim transition hover:bg-surface-2 hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 scroll-hide">
              {/* context blurb */}
              <motion.p
                className="text-[13px] leading-relaxed text-fg-muted"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                {ctx.blurb}
              </motion.p>

              {/* ask bar */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 rounded-sm border border-edge-strong bg-surface-1 px-3 focus-within:glow-primary">
                  <Sparkles className="h-4 w-4 shrink-0 text-flux-violet-bright" />
                  <input
                    ref={askRef}
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runAsk()}
                    placeholder="Ask Flux anything…"
                    className="h-10 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-dim"
                  />
                  <button
                    type="button"
                    onClick={runAsk}
                    disabled={askPending || !ask.trim()}
                    aria-label="Ask"
                    className="press text-flux-cyan disabled:opacity-40"
                  >
                    {askPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                {reply && (
                  <div className="rounded-sm border border-flux-violet/25 bg-flux-violet/[0.06] px-3 py-2 text-[13px] leading-relaxed text-fg">
                    {reply}
                  </div>
                )}
              </motion.div>

              {/* hook factory */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-3 rounded-lg border border-edge-subtle bg-surface-1 p-4"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-3.5 w-3.5 text-flux-violet-bright" />
                  <h3 className="text-sm font-semibold">Hook factory</h3>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-fg-dim">
                    14 archetypes
                  </span>
                </div>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={2}
                  placeholder="Topic…"
                  className="w-full resize-none rounded-sm border border-edge-strong bg-surface-0 p-2.5 text-xs text-fg outline-none placeholder:text-fg-dim focus:glow-primary"
                />
                <button
                  type="button"
                  onClick={runHooks}
                  disabled={hooksPending || !topic.trim()}
                  className="press inline-flex w-full items-center justify-center gap-2 rounded-sm bg-flux-violet/15 px-3 py-2 text-xs font-bold text-flux-violet-bright transition hover:bg-flux-violet/25 disabled:opacity-50"
                >
                  {hooksPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Spin 5 hooks
                </button>
                {hooks.length > 0 && (
                  <ul className="space-y-1.5">
                    {hooks.map((h, i) => (
                      <li
                        key={i}
                        className="animate-fade-up rounded-sm border border-edge-subtle bg-surface-0 p-2"
                        style={{ animationDelay: `${i * 45}ms` }}
                      >
                        <div className="text-[12px] text-fg">{h.text}</div>
                        <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.12em]">
                          <span className="text-flux-violet-bright">{h.archetype}</span>
                          {typeof h.score === 'number' && (
                            <span className="text-fg-dim">score {Math.round(h.score * 100)}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>

              {/* contextual opportunities */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-flux-cyan" />
                  <h3 className="text-label text-fg-muted">What I&apos;m seeing</h3>
                </div>
                {insights === null ? (
                  <div className="flex items-center gap-2 px-1 py-3 text-xs text-fg-dim">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your workspace…
                  </div>
                ) : (
                  <PresenceCards insights={insights.slice(0, 3)} variant="compact" />
                )}
              </motion.div>

              {/* quick link */}
              <Link
                href="/brand"
                className="press flex items-center gap-2 rounded-lg border border-edge-subtle bg-surface-1 p-3 text-xs transition hover:border-edge-strong"
              >
                <Fingerprint className="h-3.5 w-3.5 text-flux-cyan" />
                <span className="flex-1 font-semibold">Tune your brand voice</span>
                <ArrowRight className="h-3 w-3 text-fg-dim" />
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
