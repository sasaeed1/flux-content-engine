'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Images,
  LayoutDashboard,
  Palette,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/library', label: 'Library', icon: Images },
  { href: '/brand', label: 'Brand', icon: Sparkles },
  { href: '/themes', label: 'Themes', icon: Palette },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-flux-soft text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-flux-gradient" />
              )}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-border/60 bg-secondary/40 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Engine
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Content engine connected.{' '}
          <span className="text-foreground">Ready to generate.</span>
        </p>
      </div>

      <div className="m-3 mt-0 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Wand2 className="h-3.5 w-3.5" /> v0.1 · preview
      </div>
    </aside>
  );
}
