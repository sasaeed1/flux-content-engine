import { cn } from '@/lib/utils';

/**
 * Aurora — signature deep-violet / electric-cyan field that drifts behind hero
 * surfaces (Home, Forge). Richer than v1 (higher opacity, slow 30s drift),
 * pure CSS, pointer-events off. The ambient "the engine is alive" backdrop.
 */
export function AuroraBackground({
  className,
  intensity = 'default',
}: {
  className?: string;
  intensity?: 'subtle' | 'default' | 'vivid';
}) {
  const op = intensity === 'vivid' ? 1 : intensity === 'subtle' ? 0.6 : 0.82;
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
      style={{ opacity: op }}
    >
      <div
        className="absolute -top-40 -left-32 h-[560px] w-[560px] rounded-full blur-[140px] animate-aurora-drift"
        style={{ background: 'radial-gradient(circle, rgba(93,46,155,0.55), transparent 70%)' }}
      />
      <div
        className="absolute top-1/4 -right-32 h-[520px] w-[520px] rounded-full blur-[140px] animate-aurora-drift"
        style={{
          background: 'radial-gradient(circle, rgba(34,211,238,0.40), transparent 70%)',
          animationDelay: '-10s',
        }}
      />
      <div
        className="absolute -bottom-40 left-1/3 h-[480px] w-[480px] rounded-full blur-[140px] animate-aurora-drift"
        style={{
          background: 'radial-gradient(circle, rgba(236,72,153,0.30), transparent 70%)',
          animationDelay: '-20s',
        }}
      />
    </div>
  );
}
