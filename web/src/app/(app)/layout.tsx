import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';
import { CommandPalette } from '@/components/flux/command-palette';
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
      <Sidebar
        topSlot={
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
        <main className="flex-1 px-3 py-5 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-7xl animate-fade-up">{children}</div>
        </main>
        {/* Cmd/Ctrl+K opens this — always mounted at the app shell */}
        <CommandPalette />
      </div>
    </div>
  );
}
