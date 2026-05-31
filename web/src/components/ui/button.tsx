import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — v2 design system.
 * Hierarchy: primary (cyan aura CTA) · secondary (solid surface) · ghost ·
 * destructive · link. Every interactive button gets press-depress + a fast
 * glow-focus ring. Legacy variant names (default/outline/subtle) are aliased
 * so existing call-sites keep working.
 */
const buttonVariants = cva(
  'press relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold transition-all duration-150 outline-none focus-visible:glow-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // primary CTA — electric cyan aura
        primary:
          'text-flux-ink bg-flux-gradient bg-[length:200%_200%] hover:bg-[position:100%_50%] transition-[background-position,box-shadow] duration-500 glow-cta hover:shadow-[0_14px_48px_-12px_rgba(34,211,238,0.6)]',
        // secondary — raised solid surface
        secondary:
          'bg-surface-2 text-fg border border-edge-strong hover:bg-surface-3 hover:border-edge-glow inset-sheen',
        // neutral high-contrast (old "default")
        default: 'bg-fg text-flux-ink hover:opacity-90',
        outline:
          'border border-edge-strong bg-transparent text-fg hover:bg-surface-2 hover:border-flux-cyan/40',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        subtle: 'bg-surface-2 text-fg hover:bg-surface-3',
        destructive:
          'bg-state-danger/90 text-flux-ink hover:bg-state-danger shadow-[0_8px_24px_-12px_rgba(248,113,113,0.5)]',
        link: 'text-flux-cyan underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-7 text-base',
        icon: 'h-9 w-9 px-0',
        'icon-sm': 'h-8 w-8 px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
