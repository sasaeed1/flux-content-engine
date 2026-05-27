import type { ComponentProps } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtRelative } from '@/lib/format';
import type { PipelineRun } from '@/lib/types';

const STATUS_BADGE: Record<
  string,
  { variant: ComponentProps<typeof Badge>['variant']; icon: typeof CheckCircle2 }
> = {
  completed: { variant: 'success', icon: CheckCircle2 },
  ready_for_review: { variant: 'info', icon: CheckCircle2 },
  scheduled: { variant: 'info', icon: CheckCircle2 },
  failed: { variant: 'danger', icon: XCircle },
  running: { variant: 'accent', icon: CircleDashed },
  pending: { variant: 'outline', icon: CircleDashed },
};

export function RecentRuns({ runs }: { runs: PipelineRun[] }) {
  if (!runs.length) {
    return (
      <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground pattern-dots">
        <Activity className="mx-auto mb-3 h-5 w-5 text-primary" />
        <p>
          No pipeline runs yet. Click{' '}
          <span className="text-foreground">Generate 3 topics</span> or{' '}
          <span className="text-foreground">Run pipeline</span> to see your first
          one here.
        </p>
        <Link
          href="/library"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open library <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl glass">
      {runs.map((r) => {
        const cfg = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
        const Icon = cfg.icon;
        // PipelineRun.metadata may contain { carouselId } populated by the engine.
        const carouselId = (r.metadata as { carouselId?: string } | null)?.carouselId;
        const href = carouselId ? `/carousels/${carouselId}` : '/library';

        return (
          <li
            key={r.id}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <Link href={href} className="min-w-0 flex-1 group/link">
              <p className="truncate text-sm font-medium group-hover/link:text-primary">
                {r.type === 'full_pipeline' ? 'Full pipeline' : r.type}
                {r.current_step && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {r.current_step}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fmtRelative(r.started_at)}
                {r.finished_at && ` → ${fmtRelative(r.finished_at)}`}
                {r.steps_completed.length > 0 && (
                  <> · {r.steps_completed.length} steps</>
                )}
              </p>
            </Link>
            <Badge variant={cfg.variant}>{r.status.replace(/_/g, ' ')}</Badge>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </li>
        );
      })}
    </ul>
  );
}
