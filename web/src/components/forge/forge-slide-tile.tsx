'use client';

/**
 * ForgeSlideTile — a single slide as it materializes in the chamber.
 *
 * Slides don't just fade in: the role label ("Hook", "Proof", "CTA") reveals
 * first so the structure is legible as it forms, then the rendered PNG arrives
 * with a scan-line build (slide-build keyframe). The slide currently being
 * rendered glows with a thinking-aura.
 */
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ForgeTile {
  index: number;
  role?: string;
  rendered?: { publicUrl: string };
  isActive?: boolean;
}

export function ForgeSlideTile({ tile, size = 200 }: { tile: ForgeTile; size?: number }) {
  const done = !!tile.rendered;
  return (
    <div
      className={cn(
        'relative aspect-square shrink-0 overflow-hidden rounded-lg border transition-all duration-300',
        done ? 'border-edge-strong' : 'border-edge-subtle',
        tile.isActive && !done && 'glow-thinking border-flux-violet/50',
      )}
      style={{ width: size }}
    >
      {done ? (
        <Image
          src={tile.rendered!.publicUrl}
          alt={`Slide ${tile.index + 1}`}
          width={size}
          height={size}
          unoptimized
          className="h-full w-full animate-slide-build object-cover"
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center bg-surface-1">
          {/* shimmer build field */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(34,211,238,0.10) 100%)',
            }}
          />
          {tile.isActive && (
            <div className="absolute inset-0 shimmer-sweep" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
            {tile.isActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-flux-violet-bright" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-fg-dim/50" />
            )}
            {tile.role && (
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-flux-violet-bright">
                {tile.role}
              </span>
            )}
            <span className="font-mono text-[10px] text-fg-dim">{tile.index + 1}</span>
          </div>
        </div>
      )}
      {/* index chip */}
      <div className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur">
        {tile.index + 1}
      </div>
    </div>
  );
}
