/**
 * Kinetic hook intro — animated-text HTML for a reel's opening card.
 *
 * Each word of the hook rises + fades in on a staggered delay; an accent bar
 * grows in underneath; the whole card has a slow push-in. The frame renderer
 * steps these CSS animations frame-by-frame to capture true kinetic typography.
 */
export interface KineticHookOptions {
  hook: string;
  eyebrow?: string;
  width: number;
  height: number;
  /** CSS background (gradient). Defaults to the Flux cinematic gradient. */
  background?: string;
  /** Accent colour for the eyebrow + bar. */
  accent?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function kineticHookHtml(opts: KineticHookOptions): string {
  const accent = opts.accent ?? '#22D3EE';
  const bg =
    opts.background ??
    'radial-gradient(120% 80% at 50% 12%, #2a1a6b 0%, #0b0b16 62%),' +
      ' linear-gradient(160deg, #1E1B4B, #0E7490)';
  const words = opts.hook.split(/\s+/).filter(Boolean);
  const spans = words
    .map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`)
    .join(' ');
  const eyebrow = opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : '';
  // Scale the hook down for longer copy so it always fits the safe area.
  const hookSize = words.length > 9 ? 92 : words.length > 6 ? 110 : 128;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${opts.width}px;height:${opts.height}px;overflow:hidden}
    body{background:${bg};font-family:'Segoe UI','Inter',Arial,sans-serif;
      display:flex;flex-direction:column;align-items:flex-start;justify-content:center;
      padding:0 110px;color:#fff;animation:drift 4s ease-out both}
    .eyebrow{font-size:34px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;
      color:${accent};margin-bottom:44px;opacity:0;animation:fade .6s ease-out both;animation-delay:.1s}
    .hook{font-size:${hookSize}px;font-weight:800;line-height:1.05;letter-spacing:-.02em;max-width:880px}
    .w{display:inline-block;opacity:0;transform:translateY(56px);
      animation:rise .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i)*0.1s + .25s)}
    .bar{width:240px;height:12px;border-radius:6px;margin-top:60px;
      background:linear-gradient(90deg,#A78BFA,${accent});transform:scaleX(0);transform-origin:left;
      animation:grow .7s cubic-bezier(.16,1,.3,1) both;animation-delay:1.0s}
    @keyframes rise{to{opacity:1;transform:none}}
    @keyframes fade{to{opacity:1}}
    @keyframes grow{to{transform:scaleX(1)}}
    @keyframes drift{from{transform:scale(1.06)}to{transform:scale(1)}}
  </style></head><body>${eyebrow}<div class="hook">${spans}</div><div class="bar"></div></body></html>`;
}
