import { CommandRail } from '@/components/nav/command-rail';
import { MobileNav } from '@/components/nav/mobile-nav';
import { Topbar } from '@/components/nav/topbar';
import { CommandPalette } from '@/components/flux/command-palette';
import { PageTransition } from '@/components/flux/page-transition';
import { WorkspaceModeSwitcher } from '@/components/flux/workspace-mode-switcher';
import {
  getWorkspaceModeAction,
  setWorkspaceModeAction,
} from '@/app/(app)/workspace-mode-actions';

// IMPORTANT: do NOT call the engine from this layout server-side. It runs on
// every authed page; a slow/timeout call here cascades into every navigation.
// The mode switcher hydrates from a client fetch on mount instead.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      {/* Command Rail (desktop) — intent-grouped nav + mode switcher + pulse */}
      <CommandRail
        modeSlot={
          <WorkspaceModeSwitcher
            initialMode="creator"
            setMode={setWorkspaceModeAction}
            getMode={getWorkspaceModeAction}
          />
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar is an async server component (fetches org name) */}
        <Topbar />
        <main className="flex-1 px-3 pb-24 pt-5 sm:px-8 sm:py-10 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar — Forge always reachable */}
      <MobileNav />

      {/* Cmd/Ctrl+K opens this — always mounted at the app shell */}
      <CommandPalette />
    </div>
  );
}
