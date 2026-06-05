'use client';

/**
 * UserMenu — the workspace avatar in the topbar. Opens a dropdown with the
 * obvious account actions that were previously unreachable: Settings, Help,
 * and Log out. Logout is a plain <a> to the /auth/logout route handler so it
 * does a full navigation (clears the httpOnly session cookies server-side).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LifeBuoy, LogOut, Settings as SettingsIcon } from 'lucide-react';

export function UserMenu({ orgName, tier }: { orgName: string; tier?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (orgName || 'F').trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="press flex h-9 items-center gap-2 rounded-pill border border-edge-subtle bg-surface-1 pl-1 pr-2 transition hover:border-edge-strong"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flux-gradient text-xs font-bold text-flux-ink">
          {initial}
        </span>
        <span className="hidden max-w-[120px] truncate text-xs font-medium text-fg-muted sm:block">
          {orgName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-fg-dim transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-edge-strong bg-surface-1/95 backdrop-blur-xl"
          style={{ boxShadow: '0 24px 60px -16px rgba(0,0,0,0.7)' }}
        >
          <div className="border-b border-edge-subtle px-3 py-2.5">
            <div className="truncate text-sm font-semibold">{orgName}</div>
            {tier && (
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-dim">
                {tier} workspace
              </div>
            )}
          </div>
          <nav className="p-1.5" onClick={() => setOpen(false)}>
            <Link
              href="/settings"
              className="press flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <SettingsIcon className="h-4 w-4" /> Settings
            </Link>
            <Link
              href="/help"
              className="press flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <LifeBuoy className="h-4 w-4" /> Help &amp; docs
            </Link>
          </nav>
          <div className="border-t border-edge-subtle p-1.5">
            <a
              href="/auth/logout"
              className="press flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-state-danger transition hover:bg-state-danger/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
