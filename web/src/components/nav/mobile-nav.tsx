'use client';

/**
 * MobileNav — bottom tab bar mirroring the rail's primary destinations so the
 * Forge is NEVER missing on mobile (the audit flagged Studio was unreachable).
 * Forge sits center as a raised gradient CTA. Glass-frosted, safe-area aware.
 *
 * Also exports MobileNavButton (a Cmd-K trigger for the topbar on small
 * screens) so the old Topbar import keeps resolving during the transition.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Fingerprint, LayoutGrid, Search, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/home', label: 'Home', icon: Sparkles },
  { href: '/library', label: 'Library', icon: LayoutGrid },
  { href: '/forge', label: 'Forge', icon: Wand2, cta: true },
  { href: '/signals', label: 'Signals', icon: Activity },
  { href: '/brand', label: 'Brand', icon: Fingerprint },
];

function active(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === '/home' && pathname === '/dashboard') ||
    (href === '/forge' && pathname === '/studio') ||
    (href === '/library' && pathname.startsWith('/carousels')) ||
    (href === '/brand' && pathname === '/themes')
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="glass-frosted fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-edge-subtle px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        const isActive = active(pathname, tab.href);
        const Icon = tab.icon;
        if (tab.cta) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label="Forge"
              className="press relative -mt-5 flex flex-col items-center justify-center"
            >
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl text-flux-ink shadow-[0_10px_30px_-8px_rgba(34,211,238,0.6)]',
                  'bg-flux-gradient bg-[length:200%_200%]',
                  isActive && 'ring-2 ring-flux-cyan/50',
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="mt-1 text-[10px] font-semibold text-flux-violet-bright">Forge</span>
            </Link>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'press flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              isActive ? 'text-flux-cyan' : 'text-fg-dim hover:text-fg-muted',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Compact Cmd-K trigger used by the Topbar on small screens. */
export function MobileNavButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }),
        )
      }
      aria-label="Open command palette"
      className="press inline-flex h-9 w-9 items-center justify-center rounded-sm border border-edge-strong bg-surface-1 text-fg-muted transition hover:text-fg lg:hidden"
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
