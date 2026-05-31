import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-sm border border-edge-strong bg-surface-1 px-3.5 py-2 text-sm text-fg placeholder:text-fg-dim',
        'transition-[box-shadow,border-color] duration-150',
        'focus-visible:outline-none focus-visible:border-flux-cyan/50 focus-visible:glow-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
