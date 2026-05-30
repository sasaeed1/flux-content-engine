'use client';

/**
 * Motion preview pane — post-audit #5.
 *
 * Renders an animated mini-slide using a style mode's JSON config
 * (typography + palette + motion.philosophy + motion.intensity) as CSS
 * keyframes. This is the v0 of the eventual FFmpeg-driven Motion Studio:
 * it validates the data model and gives the Studio its missing cinematic
 * dimension cheaply (pure CSS, no runtime cost beyond the GPU compositor).
 *
 * Philosophies → animation language:
 *   - still:     no motion (1 tiny pulse on the accent)
 *   - subtle:    gentle fade-in + 8px drift
 *   - dynamic:   slide-in with elastic ease, sequenced lines
 *   - cinematic: parallax zoom (camera dolly), tight ease-in-out
 *   - kinetic:   letter-by-letter staggered entrance, bold motion
 *
 * Intensity 0..1 scales distance + duration. 0.5 ≈ baseline; 1.0 doubles
 * the drift distance / halves the duration for snappier feel.
 *
 * Loops every 5s so the user always sees the animation reach steady state.
 */
import { useEffect, useId, useState } from 'react';

export interface MotionStyleMode {
  key: string;
  name: string;
  typography?: {
    primary?: string;
    display?: string;
    weight_display?: number;
    hook_size?: number;
    tracking?: string;
  };
  palette?: {
    background?: string;
    foreground?: string;
    accent?: string;
    accent_soft?: string;
    gradient?: string[];
  };
  motion?: {
    philosophy?: 'still' | 'subtle' | 'dynamic' | 'cinematic' | 'kinetic';
    intensity?: number;
  };
  effects?: {
    grain?: number;
    glow?: number;
    vignette?: number;
    overlay?: string;
  };
}

interface Props {
  style: MotionStyleMode;
  /** Container is filled — pass through width/height styling at the parent. */
  className?: string;
  /** Show the live "PLAYING" indicator strip. Default true. */
  showHud?: boolean;
}

export function MotionPreview({ style, className, showHud = true }: Props) {
  const reactId = useId();
  // Bump a tick to force-restart keyframes when the style key changes
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick((t) => t + 1);
  }, [style.key]);

  // Re-tick every 5s so the loop is visible (CSS animation-iteration-count
  // would also work but a deliberate restart keeps mounts predictable).
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(i);
  }, []);

  const philosophy = style.motion?.philosophy ?? 'subtle';
  const intensity = Math.max(0, Math.min(1, style.motion?.intensity ?? 0.4));

  // Derived scalars. Distance grows with intensity, duration shrinks.
  const drift = (16 + intensity * 64).toFixed(0); // px
  const zoom = (1 + intensity * 0.18).toFixed(3); // ratio
  const dur = (1600 - intensity * 700).toFixed(0); // ms

  const bg = style.palette?.background ?? '#0a0a0a';
  const fg = style.palette?.foreground ?? '#fff';
  const accent = style.palette?.accent ?? '#22d3ee';
  const grad =
    Array.isArray(style.palette?.gradient) && style.palette!.gradient!.length >= 2
      ? `linear-gradient(135deg, ${style.palette!.gradient!.join(', ')})`
      : null;

  const fontDisplay = style.typography?.display ?? 'Inter';
  const fontPrimary = style.typography?.primary ?? 'Inter';
  const weight = style.typography?.weight_display ?? 800;
  const tracking = style.typography?.tracking ?? '-0.02em';

  // Use a scoped class so multiple previews on the same page don't collide.
  const scope = `mp-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const css = `
    .${scope} {
      position: relative;
      overflow: hidden;
      background: ${grad ?? bg};
      color: ${fg};
      border-radius: 16px;
    }
    .${scope} .stage {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12% 14%;
      text-align: center;
      gap: 8px;
    }
    .${scope} .hook {
      font-family: ${fontDisplay}, Inter, sans-serif;
      font-weight: ${weight};
      font-size: clamp(22px, 5vw, 44px);
      letter-spacing: ${tracking};
      line-height: 1;
      text-transform: uppercase;
    }
    .${scope} .accent { color: ${accent}; }
    .${scope} .sub {
      font-family: ${fontPrimary}, Inter, sans-serif;
      font-size: clamp(10px, 1.6vw, 14px);
      opacity: 0.72;
      letter-spacing: 0.02em;
    }
    .${scope} .grain {
      position: absolute; inset: 0;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='${style.effects?.grain ?? 0}'/></svg>");
      mix-blend-mode: overlay;
      pointer-events: none;
      opacity: ${style.effects?.grain ?? 0};
    }
    .${scope} .vignette {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${style.effects?.vignette ?? 0}) 100%);
      pointer-events: none;
    }
    .${scope} .glow {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 35%,
        color-mix(in srgb, ${accent} ${(style.effects?.glow ?? 0) * 60}%, transparent),
        transparent 65%);
      filter: blur(${(style.effects?.glow ?? 0) * 8}px);
      mix-blend-mode: screen;
      opacity: ${0.45 + (style.effects?.glow ?? 0) * 0.4};
      pointer-events: none;
    }
    /* Motion philosophies */
    @keyframes ${scope}-fade-in {
      from { opacity: 0; transform: translateY(${drift}px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes ${scope}-zoom-in {
      from { opacity: 0; transform: scale(${(1 / Number(zoom)).toFixed(3)}); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes ${scope}-camera-dolly {
      0%   { transform: scale(1) translateZ(0); }
      55%  { transform: scale(${zoom}) translate(${(-Number(drift) * 0.25).toFixed(0)}px, ${(-Number(drift) * 0.15).toFixed(0)}px); }
      100% { transform: scale(${zoom}) translate(${(-Number(drift) * 0.35).toFixed(0)}px, ${(-Number(drift) * 0.2).toFixed(0)}px); }
    }
    @keyframes ${scope}-slide-up {
      0%   { opacity: 0; transform: translateY(${(Number(drift) * 1.2).toFixed(0)}px) skewY(2deg); }
      60%  { opacity: 1; transform: translateY(${(-Number(drift) * 0.06).toFixed(0)}px) skewY(0deg); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes ${scope}-letter-pop {
      0%   { opacity: 0; transform: translateY(${(Number(drift) * 0.6).toFixed(0)}px) rotate(-6deg); }
      70%  { opacity: 1; transform: translateY(0) rotate(0.5deg); }
      100% { opacity: 1; transform: translateY(0) rotate(0deg); }
    }
    @keyframes ${scope}-pulse {
      0%, 100% { opacity: 0.86; }
      50% { opacity: 1; }
    }
    /* Per-philosophy mounts */
    .${scope} .stage[data-p="still"] .hook { animation: ${scope}-pulse 2400ms ease-in-out infinite; }
    .${scope} .stage[data-p="subtle"] .hook,
    .${scope} .stage[data-p="subtle"] .sub {
      animation: ${scope}-fade-in ${dur}ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .${scope} .stage[data-p="subtle"] .sub { animation-delay: 200ms; }

    .${scope} .stage[data-p="dynamic"] .hook { animation: ${scope}-slide-up ${dur}ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
    .${scope} .stage[data-p="dynamic"] .sub { animation: ${scope}-slide-up ${dur}ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both; }

    .${scope} .stage[data-p="cinematic"] {
      animation: ${scope}-camera-dolly ${(Number(dur) * 2.5).toFixed(0)}ms ease-in-out both;
    }
    .${scope} .stage[data-p="cinematic"] .hook { animation: ${scope}-zoom-in ${dur}ms ease-out both; }

    .${scope} .stage[data-p="kinetic"] .hook span {
      display: inline-block;
      animation: ${scope}-letter-pop ${(Number(dur) * 0.6).toFixed(0)}ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .${scope} .stage[data-p="kinetic"] .sub { animation: ${scope}-fade-in ${dur}ms ease-out 600ms both; }

    /* Indicator chip */
    .${scope} .hud {
      position: absolute; left: 10px; top: 10px;
      display: flex; align-items: center; gap: 6px;
      padding: 4px 8px; border-radius: 999px;
      background: rgba(0,0,0,0.55); color: #fff;
      font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; backdrop-filter: blur(8px);
      z-index: 10;
    }
    .${scope} .hud-dot {
      width: 6px; height: 6px; border-radius: 999px; background: ${accent};
      box-shadow: 0 0 8px ${accent};
      animation: ${scope}-pulse 1400ms ease-in-out infinite;
    }
  `;

  const hookText = 'YOUR HOOK LANDS HERE';
  const subText = `${style.name} · ${philosophy} ${(intensity * 100).toFixed(0)}%`;

  // For kinetic, split into spans with staggered delays.
  const renderHook = () => {
    if (philosophy === 'kinetic') {
      const letters = hookText.split('');
      return letters.map((ch, i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 28}ms` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ));
    }
    return hookText;
  };

  return (
    <div className={`${scope} ${className ?? ''}`}>
      <style>{css}</style>
      <div className="glow" />
      {/* Re-key on tick so the animation restarts every loop. */}
      <div key={tick} className="stage" data-p={philosophy}>
        <div className="hook">
          {philosophy === 'kinetic' ? renderHook() : hookText}
          <div className="accent" style={{ fontSize: '0.55em', marginTop: 6 }}>
            {/* Accent flourish */}
            ●●●
          </div>
        </div>
        <div className="sub">{subText}</div>
      </div>
      <div className="grain" />
      <div className="vignette" />
      {showHud && (
        <div className="hud">
          <span className="hud-dot" /> Live motion
        </div>
      )}
    </div>
  );
}
