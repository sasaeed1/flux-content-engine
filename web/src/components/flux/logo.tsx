import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

/**
 * Flux brand mark — a rotated "F" formed by two intersecting gradient ribbons.
 * Pure SVG, scales crisply at any size.
 */
export function Logo({ className, showWordmark = true, size = 28 }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_18px_rgba(34,211,238,0.45)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="flux-grad-a" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="55%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="flux-grad-b" x1="40" y1="0" x2="0" y2="40">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        {/* Outer rounded square */}
        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#flux-grad-a)" opacity="0.16" />
        <rect
          x="2.5"
          y="2.5"
          width="35"
          height="35"
          rx="9.5"
          stroke="url(#flux-grad-a)"
          strokeOpacity="0.55"
        />
        {/* The "F" — two ribbons */}
        <path
          d="M11 30 L11 12 Q11 10 13 10 L29 10 L29 14 L15 14 L15 19 L26 19 L26 23 L15 23 L15 30 Z"
          fill="url(#flux-grad-a)"
        />
        <path
          d="M26 19 L29 22 L26 23 Z"
          fill="url(#flux-grad-b)"
          opacity="0.85"
        />
      </svg>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">
          <span className="gradient-text">Flux</span>
        </span>
      )}
    </div>
  );
}
