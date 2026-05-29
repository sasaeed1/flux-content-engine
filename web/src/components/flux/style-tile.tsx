'use client';

/**
 * StyleTile — renders a live preview of a single style mode using its own
 * typography + palette. Used in the Studio's 40-mode picker.
 *
 * No image required — we use the mode's typography + palette + gradient
 * config to render a "real" miniature of what a hook slide would look like.
 * Cheap, deterministic, infinitely scalable.
 */
import { Lock } from 'lucide-react';

export interface StyleMode {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string;
  emotional_tone: string;
  typography: Record<string, unknown>;
  palette: Record<string, string | string[]>;
  layout: Record<string, unknown>;
  motion: Record<string, unknown>;
  effects: Record<string, unknown>;
  is_premium: boolean;
}

function gradStr(p: Record<string, string | string[]>): string {
  const grad = p.gradient;
  if (Array.isArray(grad) && grad.length >= 2) {
    return `linear-gradient(135deg, ${grad.join(', ')})`;
  }
  const bg = (p.background as string) || '#0a0a0a';
  const accent = (p.accent as string) || '#22D3EE';
  return `linear-gradient(135deg, ${bg} 0%, ${accent}25 100%)`;
}

export function StyleTile({
  mode,
  active,
  onSelect,
  disabled,
}: {
  mode: StyleMode;
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const typ = mode.typography as Record<string, string | number>;
  const pal = mode.palette as Record<string, string | string[]>;
  const fontFamily = (typ.display as string) || (typ.primary as string) || 'Inter';
  const weight = (typ.weight_display as number) || 800;
  const tracking = (typ.tracking as string) || '-0.02em';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group relative aspect-[3/4] w-full overflow-hidden rounded-xl border text-left transition-all duration-300 ${
        active
          ? 'border-primary/70 ring-2 ring-primary/40'
          : 'border-border/40 hover:border-primary/50 hover:-translate-y-0.5'
      } ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      style={{
        background: gradStr(pal),
        boxShadow: active
          ? '0 18px 60px -20px rgba(167,139,250,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 8px 24px -16px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)',
      }}
      title={mode.description}
    >
      {/* Layer 1: subtle pattern based on category */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${(pal.accent as string) || '#22D3EE'}25, transparent 60%)`,
        }}
      />

      {/* Layer 2: the actual "hook slide" preview */}
      <div
        className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4"
        style={{ color: (pal.foreground as string) || '#fafafa' }}
      >
        <div
          className="text-[8px] font-bold uppercase opacity-70"
          style={{
            color: (pal.accent as string) || '#22D3EE',
            letterSpacing: '0.18em',
          }}
        >
          {mode.emotional_tone}
        </div>

        <div
          className="leading-[0.95]"
          style={{
            fontFamily: `'${fontFamily}', system-ui, -apple-system, sans-serif`,
            fontWeight: weight,
            fontSize: 'clamp(18px, 4.5vw, 30px)',
            letterSpacing: tracking,
            color: (pal.foreground as string) || '#fafafa',
            textShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {mode.name.split(' ').slice(0, 2).join(' ')}
        </div>

        <div
          className="flex items-center justify-between text-[8px] font-medium uppercase tracking-[0.16em] opacity-60"
          style={{ color: (pal.muted as string) || (pal.foreground as string) }}
        >
          <span>{mode.category}</span>
          {mode.is_premium && (
            <span className="inline-flex items-center gap-0.5">
              <Lock className="h-2 w-2" />
              GROWTH
            </span>
          )}
        </div>
      </div>

      {/* Layer 3: hover scrim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.0) 60%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* Layer 4: name on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-4 p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">
          {mode.name}
        </div>
      </div>

      {/* Active marker */}
      {active && (
        <div
          aria-hidden
          className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_12px_2px_rgba(167,139,250,0.7)]"
        />
      )}
    </button>
  );
}
