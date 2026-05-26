import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { Button } from '@/components/ui/button';
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
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/60 bg-background/60 px-4 backdrop-blur-xl sm:px-6">
      <Link href="/dashboard" className="lg:hidden">
        <Logo showWordmark={false} />
      </Link>

      <div className="flex flex-1 items-center gap-2">
        <div className="relative hidden w-full max-w-md md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search topics, carousels, captions…"
            className="h-9 w-full rounded-lg border border-border bg-input/50 pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
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
