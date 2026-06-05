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
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  ChevronDown,
  Film,
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

/** Each mode owns a primary workspace surface. Selecting a mode jumps there —
 *  so a mode switch is a *visible* change of posture, not just an accent recolor. */
const MODE_ROUTES: Record<string, string> = {
  creator: '/forge',
  campaign: '/campaign',
  motion: '/motion',
  strategy: '/home',
  analytics: '/signals',
};

/** Reverse map: the current route tells us which mode we're actually in, so the
 *  switcher always reflects where you are (falling back to the persisted choice
 *  on mode-neutral pages like Library / Brand / Settings). */
function pathToMode(pathname: string): string | null {
  if (pathname.startsWith('/forge')) return 'creator';
  if (pathname.startsWith('/campaign')) return 'campaign';
  if (pathname.startsWith('/motion')) return 'motion';
  if (pathname.startsWith('/signals')) return 'analytics';
  if (pathname.startsWith('/home')) return 'strategy';
  return null;
}

interface Props {
  initialMode: string;
  setMode: (mode: string) => Promise<{ ok: true; mode: string }>;
  /** Optional client-side getter — called after mount to hydrate the real
   *  persisted mode without blocking the initial render. */
  getMode?: () => Promise<string>;
}

export function WorkspaceModeSwitcher({ initialMode, setMode, getMode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [persisted, setPersisted] = useState(initialMode || 'creator');
  const [pending, start] = useTransition();

  // Active mode = where you ARE (route-derived) first, else your persisted
  // choice. This keeps the switcher truthful: navigate to Motion and it reads
  // "Motion"; sit on a neutral page and it remembers your last pick.
  const routeMode = pathToMode(pathname);
  const active = routeMode ?? persisted;

  // Hydrate the persisted mode after mount. Non-blocking — if the engine is
  // slow, the user sees the default and gets the right value when it lands.
  useEffect(() => {
    if (!getMode) return;
    let alive = true;
    void getMode()
      .then((m) => {
        if (alive && m) setPersisted(m);
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      alive = false;
    };
  }, [getMode]);

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

  // Mode behavior: recolor the workspace accent. Writes --mode-accent + a
  // data-flux-mode attribute on <html> so the rail, pulse, and CTAs can tint
  // by posture — modes finally have a visible effect (audit: were visual-only).
  useEffect(() => {
    const ACCENTS: Record<string, string> = {
      creator: '#A78BFA',
      campaign: '#EC4899',
      motion: '#22D3EE',
      strategy: '#34D399',
      analytics: '#F5B544',
    };
    const root = document.documentElement;
    root.dataset.fluxMode = active;
    root.style.setProperty('--mode-accent', ACCENTS[active] ?? '#A78BFA');
  }, [active]);

  const pick = (key: string) => {
    setOpen(false);
    // Remember the choice (so neutral pages still reflect it) and persist it
    // server-side in the background — but the headline effect is navigation:
    // jump to the mode's home so the whole workspace visibly changes.
    setPersisted(key);
    start(async () => {
      try {
        await setMode(key);
      } catch {
        /* persist failure is non-fatal — navigation still happens */
      }
    });
    const dest = MODE_ROUTES[key] ?? '/home';
    if (pathname !== dest) router.push(dest);
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
