'use client';

/**
 * Cmd-K — universal AI command palette.
 *
 * Opens on Cmd/Ctrl+K. Two modes inside:
 *   1. Quick actions — keyboard-navigated list of static actions (open
 *      route, switch theme, etc.).
 *   2. AI mode — natural language input ("Generate 10 SaaS hooks for
 *      next month") sent to the engine intelligence layer, which returns
 *      a structured action the palette executes.
 *
 * Aesthetic: deep glass card with gradient border, cinematic backdrop blur,
 * keyboard-first navigation, AI-first defaults. Inspired by Raycast / Linear.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Images,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Palette,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  commandHistoryAction,
  generateTopicsViaCmdAction,
  runCommandAction,
  runPipelineViaCmdAction,
} from '@/app/(app)/command-actions';

interface CmdHistory {
  id: string;
  raw_input: string;
  parsed_action: string | null;
}

interface QuickAction {
  id: string;
  label: string;
  hint: string;
  icon: typeof Search;
  keywords: string[];
  /** Either a route to push or an async handler that runs and closes. */
  run: (
    router: ReturnType<typeof useRouter>,
    helpers: { setReply: (s: string) => void; close: () => void; setPending: (p: boolean) => void },
  ) => void | Promise<void>;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'open-forge',
    label: 'Open the Forge',
    hint: 'Create a carousel',
    icon: Wand2,
    keywords: ['forge', 'create', 'generate', 'new', 'studio'],
    run: (r) => r.push('/forge'),
  },
  {
    id: 'open-home',
    label: 'Open home',
    hint: 'Mission control',
    icon: LayoutDashboard,
    keywords: ['home', 'dashboard', 'overview', 'opportunities'],
    run: (r) => r.push('/home'),
  },
  {
    id: 'open-library',
    label: 'Open library',
    hint: 'Review carousels',
    icon: Images,
    keywords: ['library', 'carousels', 'posts', 'review'],
    run: (r) => r.push('/library'),
  },
  {
    id: 'open-brand',
    label: 'Open Brand Studio',
    hint: 'Voice + Looks',
    icon: Sparkles,
    keywords: ['brand', 'voice', 'tone', 'colors', 'themes', 'styles', 'looks'],
    run: (r) => r.push('/brand'),
  },
  {
    id: 'open-styles',
    label: 'Browse 40 style modes',
    hint: 'Static + motion previews',
    icon: Palette,
    keywords: ['themes', 'styles', 'visual', 'looks', 'motion'],
    run: (r) => r.push('/brand?tab=looks'),
  },
  {
    id: 'open-signals',
    label: 'Open Signals',
    hint: 'Performance intelligence',
    icon: Calendar,
    keywords: ['signals', 'analytics', 'performance', 'stats'],
    run: (r) => r.push('/signals'),
  },
  {
    id: 'open-settings',
    label: 'Open settings',
    hint: 'Workspace + Instagram',
    icon: SettingsIcon,
    keywords: ['settings', 'instagram', 'api', 'billing'],
    run: (r) => r.push('/settings'),
  },
  {
    id: 'open-help',
    label: 'Open help center',
    hint: 'FAQs + walkthroughs',
    icon: LifeBuoy,
    keywords: ['help', 'docs', 'support'],
    run: (r) => r.push('/help'),
  },
  {
    id: 'generate-3-topics',
    label: 'Generate 3 topics',
    hint: 'Fill the queue',
    icon: Plus,
    keywords: ['topics', 'ideas', 'generate'],
    run: async (r, h) => {
      h.setPending(true);
      try {
        const res = await generateTopicsViaCmdAction(3);
        h.setReply(`Added ${res.inserted} topics to your queue.`);
        r.refresh();
      } catch (e) {
        h.setReply(e instanceof Error ? e.message : 'Failed.');
      } finally {
        h.setPending(false);
      }
    },
  },
  {
    id: 'run-pipeline',
    label: 'Run pipeline now',
    hint: 'Produce next carousel',
    icon: Zap,
    keywords: ['run', 'generate', 'carousel', 'pipeline'],
    run: async (r, h) => {
      h.setPending(true);
      try {
        await runPipelineViaCmdAction();
        h.setReply('Carousel produced. Review it in the library.');
        r.push('/library');
        h.close();
      } catch (e) {
        h.setReply(e instanceof Error ? e.message : 'Failed.');
      } finally {
        h.setPending(false);
      }
    },
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [displayedReply, setDisplayedReply] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [pending, start] = useTransition();
  const [localPending, setLocalPending] = useState(false);
  const [history, setHistory] = useState<CmdHistory[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sprint C — fetch recent commands once per open for the recall list.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void commandHistoryAction()
      .then((res) => {
        if (alive) setHistory(res.history as CmdHistory[]);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Sprint C — typewriter reveal of the AI reply (perceived streaming: the
  // engine returns the full reply, we type it out so it feels like the engine
  // is "speaking" rather than popping a spinner result).
  useEffect(() => {
    if (!reply) {
      setDisplayedReply('');
      return;
    }
    setDisplayedReply('');
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setDisplayedReply(reply.slice(0, i));
      if (i >= reply.length) clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [reply]);

  // Global hotkey: Cmd/Ctrl + K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setReply(null);
      setAiMode(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Body scroll lock while open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Filter quick actions by query (substring match on label + keywords).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_ACTIONS;
    return QUICK_ACTIONS.filter((a) => {
      if (a.label.toLowerCase().includes(q)) return true;
      return a.keywords.some((k) => k.includes(q));
    });
  }, [query]);

  const askAi = () => {
    if (!query.trim()) return;
    setLocalPending(true);
    setReply(null);
    start(async () => {
      try {
        const res = await runCommandAction(query.trim());
        setReply(res.reply);
        // Execute structured action returned by the engine.
        switch (res.action) {
          case 'navigate':
            if (typeof res.args?.path === 'string') {
              router.push(res.args.path);
              setOpen(false);
            }
            break;
          case 'generate_topics': {
            const count =
              typeof res.args?.count === 'number'
                ? Math.max(1, Math.min(20, res.args.count))
                : 3;
            const theme = typeof res.args?.theme === 'string' ? res.args.theme : undefined;
            const out = await generateTopicsViaCmdAction(count, theme);
            setReply(`Added ${out.inserted} topics to your queue.`);
            router.refresh();
            break;
          }
          case 'run_pipeline':
            await runPipelineViaCmdAction();
            setReply('Carousel produced — opening library…');
            router.push('/library');
            setOpen(false);
            break;
          case 'switch_theme':
            if (typeof res.args?.themeKey === 'string') {
              router.push(`/brand?theme=${encodeURIComponent(res.args.themeKey)}`);
              setOpen(false);
            }
            break;
          case 'show_insights':
            router.push('/home');
            setOpen(false);
            break;
          default:
            // unknown → leave the reply text on screen
            break;
        }
      } catch (e) {
        setReply(e instanceof Error ? e.message : 'Command failed.');
      } finally {
        setLocalPending(false);
      }
    });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (aiMode || query.startsWith('>')) {
        askAi();
      } else if (filtered[activeIdx]) {
        const act = filtered[activeIdx];
        const result = act.run(router, {
          setReply,
          close: () => setOpen(false),
          setPending: setLocalPending,
        });
        if (result instanceof Promise) result.then(() => {});
        if (!aiMode && act.id.startsWith('open-')) setOpen(false);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setAiMode((v) => !v);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 16px 0',
        animation: 'fluxFade 0.18s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cmdk-card"
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'linear-gradient(180deg, rgba(15,15,22,0.96), rgba(8,8,14,0.96))',
          border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: 16,
          boxShadow:
            '0 50px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px -20px rgba(167,139,250,0.3)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header: input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: aiMode
              ? 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(34,211,238,0.07))'
              : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          {aiMode || query.startsWith('>') ? (
            <Sparkles size={16} className="text-primary" style={{ color: '#22d3ee' }} />
          ) : (
            <Search size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
              if (e.target.value.startsWith('>')) setAiMode(true);
              else if (aiMode && !e.target.value) setAiMode(false);
            }}
            onKeyDown={onKey}
            placeholder={
              aiMode
                ? 'Ask Flux anything — e.g. "Generate 10 SaaS topics"'
                : 'Search · type > to ask AI · ↑↓ to navigate · Enter to run'
            }
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          />
          {(localPending || pending) && (
            <Loader2 size={14} className="animate-spin" style={{ color: '#22d3ee' }} />
          )}
          <kbd
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 5,
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Body */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {!aiMode && filtered.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {filtered.map((a, i) => {
                const Icon = a.icon;
                const active = i === activeIdx;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const result = a.run(router, {
                          setReply,
                          close: () => setOpen(false),
                          setPending: setLocalPending,
                        });
                        if (result instanceof Promise) result.then(() => {});
                        if (a.id.startsWith('open-')) setOpen(false);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 18px',
                        background: active ? 'rgba(167,139,250,0.12)' : 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: 14,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                    >
                      <Icon size={15} style={{ color: '#a5b4fc' }} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{a.label}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{a.hint}</span>
                      {active && <ArrowRight size={13} style={{ color: '#22d3ee' }} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!aiMode && filtered.length === 0 && (
            <div style={{ padding: '20px 18px', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              No quick action. Press <kbd style={kbdStyle}>Tab</kbd> to ask AI instead.
            </div>
          )}
          {aiMode && (
            <div style={{ padding: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(34,211,238,0.04))',
                  border: '1px dashed rgba(167,139,250,0.30)',
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.5,
                }}
              >
                <Wand2 size={13} style={{ color: '#22d3ee' }} />
                <span>
                  AI mode. Try: <em>&quot;Generate 5 topics about real estate&quot;</em>,{' '}
                  <em>&quot;Open library&quot;</em>, <em>&quot;Run pipeline&quot;</em>, <em>&quot;Switch to luxury black theme&quot;</em>.
                </span>
              </div>
              {/* thinking state — perceived streaming */}
              {(localPending || pending) && !reply && (
                <div
                  className="shimmer-sweep"
                  style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(167,139,250,0.08)',
                    border: '1px solid rgba(167,139,250,0.28)',
                    color: '#ddd6fe',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Sparkles size={13} className="animate-pulse" />
                  Flux is thinking…
                </div>
              )}

              {/* typewriter reply */}
              {reply && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(34,197,94,0.10)',
                    border: '1px solid rgba(34,197,94,0.28)',
                    color: '#bbf7d0',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {displayedReply}
                  {displayedReply.length < reply.length && (
                    <span style={{ opacity: 0.7 }} className="animate-pulse">▋</span>
                  )}
                </div>
              )}

              {/* recent commands (recall) */}
              {!reply && !(localPending || pending) && !query.trim() && history.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 6,
                      paddingLeft: 2,
                    }}
                  >
                    Recent
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {history.slice(0, 5).map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setQuery(h.raw_input);
                          setTimeout(askAi, 0);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.02)',
                          color: 'rgba(255,255,255,0.78)',
                          fontSize: 12.5,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Search size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h.raw_input}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!reply && !(localPending || pending) && (
                <button
                  type="button"
                  onClick={askAi}
                  disabled={!query.trim() || localPending || pending}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background:
                      'linear-gradient(135deg, #A78BFA 0%, #22D3EE 50%, #EC4899 100%)',
                    color: '#0a0a13',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    opacity: !query.trim() ? 0.5 : 1,
                    boxShadow: '0 10px 28px -8px rgba(34,211,238,0.5)',
                  }}
                >
                  <Send size={13} />
                  Ask Flux
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span>
              <kbd style={kbdStyle}>↑↓</kbd> Navigate
            </span>
            <span>
              <kbd style={kbdStyle}>↵</kbd> Run
            </span>
            <span>
              <kbd style={kbdStyle}>Tab</kbd> AI mode
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={11} style={{ color: '#22d3ee' }} />
            Flux Intelligence
          </span>
        </div>

        <style>{`
          @keyframes fluxFade { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
          .cmdk-card { animation: fluxFade 0.22s ease; }
        `}</style>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  padding: '1.5px 5px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
};
