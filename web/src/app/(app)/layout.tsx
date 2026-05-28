import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';
import { CommandPalette } from '@/components/flux/command-palette';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
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
