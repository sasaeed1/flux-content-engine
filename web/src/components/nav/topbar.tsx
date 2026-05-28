import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { Button } from '@/components/ui/button';
import { MobileNavButton } from '@/components/nav/mobile-nav';
import { CmdKSearchButton } from '@/components/nav/cmdk-search-button';
import { api } from '@/lib/api-client';

export async function Topbar() {
  // Fetch org name server-side. Falls back to env if the engine isn't reachable.
  let orgName = process.env.NEXT_PUBLIC_FLUX_APP_NAME ?? 'Flux';
  try {
    const { organization } = await api.me();
    if (organization?.name) orgName = organization.name;
  } catch {
    /* engine down — show fallback */
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl sm:px-6">
      {/* Mobile: hamburger that opens the drawer */}
      <MobileNavButton />

      <Link href="/dashboard" className="shrink-0 lg:hidden">
        <Logo showWordmark={false} />
      </Link>

      <div className="flex flex-1 items-center gap-2">
        <CmdKSearchButton />
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-muted-foreground">Workspace:</span>
          <span className="font-medium">{orgName}</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
