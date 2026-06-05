import Link from 'next/link';
import { Wand2 } from 'lucide-react';
import { Logo } from '@/components/flux/logo';
import { MobileNavButton } from '@/components/nav/mobile-nav';
import { CmdKSearchButton } from '@/components/nav/cmdk-search-button';
import { TopbarPulse } from '@/components/nav/topbar-pulse';
import { CopilotTrigger } from '@/components/flux/copilot-trigger';
import { UserMenu } from '@/components/nav/user-menu';
import { api } from '@/lib/api-client';

/**
 * Topbar — slim, glass-frosted. Holds the Cmd-K search trigger (the AI front
 * door), a compact Engine Pulse mirror, a Copilot summon, and a Forge CTA for
 * small screens. The org pill moved to a quiet status dot.
 */
export async function Topbar() {
  let orgName = process.env.NEXT_PUBLIC_FLUX_APP_NAME ?? 'Flux';
  let tier: string | undefined;
  try {
    const { organization } = await api.me();
    if (organization?.name) orgName = organization.name;
    tier = organization?.subscription_tier ?? undefined;
  } catch {
    /* engine down — show fallback */
  }

  return (
    <header className="glass-frosted sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-edge-subtle px-3 sm:px-6">
      <MobileNavButton />

      <Link href="/home" className="shrink-0 lg:hidden" aria-label="Flux home">
        <Logo showWordmark={false} />
      </Link>

      <div className="flex flex-1 items-center gap-2">
        <CmdKSearchButton />
      </div>

      <div className="flex items-center gap-2">
        {/* compact engine pulse mirror */}
        <div className="hidden h-9 items-center rounded-pill border border-edge-subtle bg-surface-1 px-2.5 sm:flex">
          <TopbarPulse />
        </div>

        {/* Forge CTA — small screens (rail has it on desktop) */}
        <Link
          href="/forge"
          className="press inline-flex h-9 items-center gap-1.5 rounded-sm bg-flux-gradient px-3 text-xs font-bold text-flux-ink glow-cta lg:hidden"
        >
          <Wand2 className="h-3.5 w-3.5" /> Forge
        </Link>

        {/* Copilot summon */}
        <CopilotTrigger />

        {/* Account — settings, help, log out */}
        <UserMenu orgName={orgName} tier={tier} />
      </div>
    </header>
  );
}
