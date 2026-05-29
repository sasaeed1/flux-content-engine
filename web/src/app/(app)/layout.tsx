import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';
import { CommandPalette } from '@/components/flux/command-palette';
import { WorkspaceModeSwitcher } from '@/components/flux/workspace-mode-switcher';
import { setWorkspaceModeAction } from '@/app/(app)/workspace-mode-actions';
import { api } from '@/lib/api-client';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Load the active mode server-side so the sidebar renders without a flash.
  // If anything fails (no plan-info, engine down) we fall back to 'creator'.
  let initialMode = 'creator';
  try {
    const res = await api.intelligence.getMode();
    if (res?.mode) initialMode = res.mode;
  } catch {
    /* engine unreachable — keep default */
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        topSlot={
          <WorkspaceModeSwitcher
            initialMode={initialMode}
            setMode={setWorkspaceModeAction}
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
