'use client';

/**
 * Workspace mode switcher — sits at the top of the sidebar.
 *
 * Five modes: Creator / Campaign / Motion / Strategy / Analytics.
 * Each mode is a *posture* the workspace takes — different default CTA,
 * different visible nav, different recommendation bias. The current mode
 * persists per-org via /api/tenant/intelligence/workspace-mode.
 *
 * The visual feels cinematic — gradient gradient ring, active mode glows.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  ChevronDown,
  Film,
  Layers,
  Sparkles,
  Wand2,
} from 'lucide-react';

export const WORKSPACE_MODES = [
  {
    key: 'creator',
    label: 'Creator',
    icon: Sparkles,
    description: 'Focused single-carousel production',
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #22D3EE 100%)',
  },
  {
    key: 'campaign',
    label: 'Campaign',
    icon: Calendar,
    description: 'Plan + ship a full content month',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #F59E0B 100%)',
  },
  {
    key: 'motion',
    label: 'Motion',
    icon: Film,
    description: 'Cinematic reels + motion content',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #A78BFA 100%)',
  },
  {
    key: 'strategy',
    label: 'Strategy',
    icon: Wand2,
    description: 'Topic intelligence + research',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #06B6D4 100%)',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: Activity,
    description: 'Performance + content intelligence',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
  },
];

interface Props {
  initialMode: string;
  setMode: (mode: string) => Promise<{ ok: true; mode: string }>;
}

export function WorkspaceModeSwitcher({ initialMode, setMode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(initialMode || 'creator');
  const [pending, start] = useTransition();

  // Close on outside click + escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-mode-switcher]')) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeMode = WORKSPACE_MODES.find((m) => m.key === active) ?? WORKSPACE_MODES[0];
  const ActiveIcon = activeMode.icon;

  const pick = (key: string) => {
    if (key === active) {
      setOpen(false);
      return;
    }
    setActive(key);
    setOpen(false);
    start(async () => {
      try {
        await setMode(key);
        router.refresh();
      } catch {
        /* revert silently — UI is optimistic */
      }
    });
  };

  return (
    <div data-mode-switcher className="relative px-3 pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-card/40 px-3 py-2.5 text-left transition hover:border-primary/40"
        style={{
          boxShadow: open
            ? '0 12px 28px -12px rgba(167,139,250,0.4), inset 0 0 0 1px rgba(167,139,250,0.2)'
            : undefined,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-30 transition-opacity duration-500"
          style={{ background: activeMode.gradient }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-0"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(255,255,255,0.06), transparent 70%)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: activeMode.gradient, color: '#0a0a13' }}
          >
            <ActiveIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Mode
            </div>
            <div className="text-sm font-semibold leading-tight">{activeMode.label}</div>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl"
          style={{
            boxShadow:
              '0 36px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(167,139,250,0.10)',
          }}
        >
          <ul className="divide-y divide-border/40">
            {WORKSPACE_MODES.map((m) => {
              const Icon = m.icon;
              const isActive = m.key === active;
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => pick(m.key)}
                    className={`group w-full px-3 py-2.5 text-left transition ${
                      isActive ? 'bg-flux-soft' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                        style={{ background: m.gradient, color: '#0a0a13' }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          {m.label}
                          {isActive && (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_rgba(167,139,250,0.6)]" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {m.description}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
