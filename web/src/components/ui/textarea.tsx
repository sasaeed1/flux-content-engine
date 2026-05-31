import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-sm border border-edge-strong bg-surface-1 px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-dim',
      'transition-[box-shadow,border-color] duration-150 resize-y',
      'focus-visible:outline-none focus-visible:border-flux-cyan/50 focus-visible:glow-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
