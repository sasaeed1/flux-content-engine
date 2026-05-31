import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-fg-muted border border-edge-subtle',
        outline: 'border border-edge-strong text-fg-muted',
        accent: 'bg-flux-soft text-fg border border-flux-cyan/25',
        // AI / intelligence — violet
        thinking: 'bg-flux-violet/15 text-flux-violet-bright border border-flux-violet/30',
        // opportunity / performance — gold
        opportunity: 'bg-flux-gold/15 text-flux-gold border border-flux-gold/30',
        success: 'bg-state-success/15 text-state-success border border-state-success/30',
        warning: 'bg-state-warning/15 text-state-warning border border-state-warning/30',
        danger: 'bg-state-danger/15 text-state-danger border border-state-danger/30',
        info: 'bg-state-info/15 text-state-info border border-state-info/30',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
