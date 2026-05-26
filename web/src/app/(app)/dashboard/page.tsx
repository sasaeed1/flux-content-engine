import { Clock, Eye, Images, ListChecks, Send } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentRuns } from '@/components/dashboard/recent-runs';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import type { OrgOverview, PipelineRun } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  let overview: OrgOverview | null = null;
  let runs: PipelineRun[] = [];
  let connectionError: string | null = null;

  try {
    [{ overview }, { runs }] = await Promise.all([
      api.overview(),
      api.recentRuns(8),
    ]);
  } catch (err) {
    connectionError = err instanceof Error ? err.message : 'Engine unreachable.';
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace overview"
        title={
          <>
            Welcome back to <span className="gradient-text">Flux</span>.
          </>
        }
        subtitle={
          overview
            ? `${overview.name} · ${overview.subscription_tier.toUpperCase()} tier`
            : 'AI Instagram content, on autopilot.'
        }
        actions={
          overview && (
            <Badge variant={overview.active ? 'success' : 'warning'}>
              {overview.active ? 'Active' : 'Paused'}
            </Badge>
          )
        }
      />

      {connectionError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-red-200">
          <strong className="font-medium">Engine unreachable —</strong> {connectionError}
          <p className="mt-1 text-xs text-red-300/80">
            Make sure the content engine is running at{' '}
            <code className="rounded bg-black/30 px-1 py-0.5">
              {process.env.CONTENT_ENGINE_URL ?? 'http://localhost:8090'}
            </code>
            .
          </p>
        </div>
      )}

      {/* Stat grid */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Pending topics"
          value={overview?.pending_topics ?? 0}
          icon={ListChecks}
          accent="violet"
          hint="Ideas queued for the next pipeline"
        />
        <StatCard
          label="Ready to publish"
          value={overview?.ready_carousels ?? 0}
          icon={Images}
          accent="cyan"
          hint="Carousels approved or queued"
        />
        <StatCard
          label="Scheduled"
          value={overview?.queue_pending ?? 0}
          icon={Clock}
          accent="magenta"
          hint="Awaiting their publish slot"
        />
        <StatCard
          label="Published total"
          value={overview?.published_total ?? 0}
          icon={Send}
          accent="emerald"
          hint={
            overview?.total_views ? `${overview.total_views.toLocaleString()} views logged` : 'No analytics yet'
          }
        />
      </section>

      {/* Two-column */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recent pipeline runs
            </h2>
            <span className="text-xs text-muted-foreground">last 8</span>
          </div>
          <RecentRuns runs={runs} />
        </div>
        <div className="space-y-4">
          <QuickActions />
          <div className="rounded-2xl glass p-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What Flux does
              </h3>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground">1.</span> Researches a topic and writes the
                slide-by-slide script.
              </li>
              <li>
                <span className="text-foreground">2.</span> Renders each slide as a branded image
                via the template engine.
              </li>
              <li>
                <span className="text-foreground">3.</span> Uploads to storage, drafts the caption,
                and queues for Instagram.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
