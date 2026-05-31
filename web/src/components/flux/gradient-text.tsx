import type { ElementType, JSX, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * GradientText — the signature violet→cyan→magenta sweep.
 * `glow` adds a drop-shadow halo for hero moments.
 */
export function GradientText({
  children,
  className,
  glow = false,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  as?: keyof JSX.IntrinsicElements;
}) {
  const Component = Tag as ElementType;
  return (
    <Component className={cn(glow ? 'gradient-text-glow' : 'gradient-text', className)}>
      {children}
    </Component>
  );
}
