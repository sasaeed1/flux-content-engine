import { cn } from '@/lib/utils';

/**
 * Aurora — three softly-blurred gradient blobs that drift behind hero sections.
 * Pure CSS / Tailwind keyframes, no JS. Pointer-events disabled.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-flux-violet/30 blur-[120px] animate-aurora" />
      <div
        className="absolute top-1/3 -right-24 h-[460px] w-[460px] rounded-full bg-flux-cyan/25 blur-[120px] animate-aurora"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="absolute -bottom-32 left-1/3 h-[420px] w-[420px] rounded-full bg-flux-magenta/20 blur-[120px] animate-aurora"
        style={{ animationDelay: '-14s' }}
      />
    </div>
  );
}
