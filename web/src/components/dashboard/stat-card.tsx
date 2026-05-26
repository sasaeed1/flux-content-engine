import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtNumber } from '@/lib/format';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  icon: LucideIcon;
  accent?: 'violet' | 'cyan' | 'magenta' | 'emerald';
  trend?: string;
  className?: string;
}

const ACCENT: Record<NonNullable<StatCardProps['accent']>, string> = {
  violet: 'from-flux-violet/30 to-transparent text-flux-violet',
  cyan: 'from-flux-cyan/30 to-transparent text-flux-cyan',
  magenta: 'from-flux-magenta/30 to-transparent text-flux-magenta',
  emerald: 'from-emerald-400/30 to-transparent text-emerald-300',
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'cyan',
  trend,
  className,
}: StatCardProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl glass glass-hover p-5', className)}>
      <div
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br blur-3xl opacity-70',
          ACCENT[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {typeof value === 'number' ? fmtNumber(value) : (value ?? '—')}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div className={cn('rounded-lg bg-background/40 p-2', ACCENT[accent].split(' ').slice(-1)[0])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {trend && (
        <div className="relative mt-4 inline-flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          <ArrowUpRight className="h-3 w-3" />
          {trend}
        </div>
      )}
    </div>
  );
}
