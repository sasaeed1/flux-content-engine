import type { ComponentProps } from 'react';
import { Activity, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtRelative } from '@/lib/format';
import type { PipelineRun } from '@/lib/types';

const STATUS_BADGE: Record<string, { variant: ComponentProps<typeof Badge>['variant']; icon: typeof CheckCircle2 }> = {
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
        No pipeline runs yet. Generate a topic and hit{' '}
        <span className="text-foreground">Run pipeline</span> to see your first one here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl glass">
      {runs.map((r) => {
        const cfg = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
        const Icon = cfg.icon;
        return (
          <li
            key={r.id}
            className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/40">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
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
            </div>
            <Badge variant={cfg.variant}>{r.status.replace(/_/g, ' ')}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
