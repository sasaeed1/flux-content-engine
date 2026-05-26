import type { ElementType, JSX, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function GradientText({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}) {
  const Component = Tag as ElementType;
  return <Component className={cn('gradient-text', className)}>{children}</Component>;
}
