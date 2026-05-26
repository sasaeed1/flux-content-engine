import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  accent?: 'violet' | 'cyan' | 'magenta' | 'gradient';
}

/**
 * Elevated glass surface with optional accent glow.
 * Use sparingly — typically for the primary stat / hero card on a page.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow = false, accent = 'gradient', children, ...props }, ref) => {
    const glowColor =
      accent === 'violet'
        ? 'shadow-[0_30px_80px_-30px_rgba(167,139,250,0.55)]'
        : accent === 'cyan'
          ? 'shadow-[0_30px_80px_-30px_rgba(34,211,238,0.55)]'
          : accent === 'magenta'
            ? 'shadow-[0_30px_80px_-30px_rgba(236,72,153,0.55)]'
            : 'shadow-[0_30px_80px_-30px_rgba(124,58,237,0.45)]';

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-2xl glass p-6 transition-transform duration-300',
          glow && glowColor,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassCard.displayName = 'GlassCard';
