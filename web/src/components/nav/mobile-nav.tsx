'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  HelpCircle,
  Images,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Palette,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/library', label: 'Library', icon: Images },
  { href: '/brand', label: 'Brand', icon: Sparkles },
  { href: '/themes', label: 'Themes', icon: Palette },
];

const secondary = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: LifeBuoy },
];

export function MobileNavButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (after a nav tap).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when the drawer is open so the page behind doesn't move.
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/40 text-muted-foreground transition hover:text-foreground lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur-xl transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-label="Navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-flux-soft text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="my-3 mx-3 h-px bg-border/60" />
          {secondary.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-flux-soft text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-3">
          <a
            href="/auth/logout"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </a>
        </div>
      </aside>
    </>
  );
}
