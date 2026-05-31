'use client';

/**
 * CommandRail — the persistent left navigation, rebuilt from first principles.
 *
 * Organized by INTENT (Discover / Create / Manage), not object type. The
 * workspace-mode switcher pins the top and recolors the rail accent; the
 * Engine Pulse pins the bottom as the ambient AI-activity heartbeat. The
 * primary "Forge" destination is also a glowing CTA so creation is always one
 * click away. Collapsible 248px ⇄ 76px (persisted).
 *
 * Desktop only — mobile uses MobileNav (bottom bar).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ChevronsLeft,
  Fingerprint,
  LayoutGrid,
  PanelLeft,
  Settings,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { EnginePulse } from '@/components/flux/engine-pulse';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: typeof Sparkles; cta?: boolean };
type Group = { intent: string; items: Item[] };

const GROUPS: Group[] = [
  {
    intent: 'Discover',
    items: [
      { href: '/home', label: 'Home', icon: Sparkles },
      { href: '/signals', label: 'Signals', icon: Activity },
    ],
  },
  {
    intent: 'Create',
    items: [{ href: '/forge', label: 'Forge', icon: Wand2, cta: true }],
  },
  {
    intent: 'Manage',
    items: [
      { href: '/library', label: 'Library', icon: LayoutGrid },
      { href: '/brand', label: 'Brand Studio', icon: Fingerprint },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const STORAGE_KEY = 'flux.rail.collapsed';

export function CommandRail({ modeSlot }: { modeSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate collapse preference.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    // map legacy routes to their new homes so the rail highlights correctly
    (href === '/home' && pathname === '/dashboard') ||
    (href === '/forge' && pathname === '/studio') ||
    (href === '/library' && pathname.startsWith('/carousels')) ||
    (href === '/brand' && pathname === '/themes');

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'group/rail relative hidden h-dvh shrink-0 flex-col border-r border-edge-subtle bg-surface-0/80 backdrop-blur-xl transition-[width] duration-300 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[248px]',
      )}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/home" aria-label="Flux home" className="press">
          {collapsed ? <Logo showWordmark={false} size={26} /> : <Logo />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="press inline-flex h-7 w-7 items-center justify-center rounded-sm text-fg-dim transition hover:bg-surface-2 hover:text-fg"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Mode switcher (pinned top) */}
      {!collapsed && modeSlot && <div className="px-2">{modeSlot}</div>}

      {/* Intent-grouped nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4 scroll-hide">
        {GROUPS.map((group) => (
          <div key={group.intent} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-dim">
                {group.intent}
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'press group/item relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all',
                    collapsed && 'justify-center px-0',
                    item.cta
                      ? active
                        ? 'bg-flux-gradient text-flux-ink glow-cta'
                        : 'bg-flux-violet/15 text-flux-violet-bright ring-1 ring-flux-violet/30 hover:bg-flux-violet/25 hover:ring-flux-violet/50'
                      : active
                        ? 'bg-surface-2 text-fg'
                        : 'text-fg-muted hover:bg-surface-1 hover:text-fg',
                  )}
                >
                  {/* active accent bar (non-CTA) */}
                  {active && !item.cta && (
                    <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-flux-gradient" />
                  )}
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      item.cta
                        ? active
                          ? 'text-flux-ink'
                          : 'text-flux-violet-bright'
                        : active
                          ? 'text-flux-cyan'
                          : '',
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && item.cta && (
                    <kbd className="ml-auto rounded border border-white/15 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] opacity-80">
                      C
                    </kbd>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Engine pulse (pinned bottom) + expand toggle when collapsed */}
      <div className="border-t border-edge-subtle p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <EnginePulse />
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand sidebar"
              className="press inline-flex h-7 w-7 items-center justify-center rounded-sm text-fg-dim transition hover:bg-surface-2 hover:text-fg"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-edge-subtle bg-surface-1 px-3 py-2.5">
            <EnginePulse expanded />
          </div>
        )}
      </div>
    </aside>
  );
}
