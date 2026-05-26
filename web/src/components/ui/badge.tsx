import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground',
        outline: 'border border-border text-muted-foreground',
        accent: 'bg-flux-soft text-foreground border border-primary/20',
        success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
        danger: 'bg-destructive/15 text-red-300 border border-destructive/30',
        info: 'bg-primary/15 text-primary border border-primary/30',
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
