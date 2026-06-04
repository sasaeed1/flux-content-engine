#!/usr/bin/env tsx
/**
 * Standalone kinetic-typography smoke test — proves the Puppeteer frame-capture
 * pipeline produces a real animated-text MP4 (no Supabase / LLM).
 *
 *   npx tsx scripts/test-kinetic.ts
 *
 * Writes ../flux-kinetic-demo.mp4 — a hook headline animating in word-by-word
 * on a cinematic gradient, captured frame-by-frame from headless Chrome.
 */
import path from 'node:path';

const HOOK = "You're Not Limited By Your Team's Size";

function buildHtml(hook: string): string {
  const words = hook.split(' ');
  const spans = words
    .map((w, i) => `<span class="w" style="--i:${i}">${escapeHtml(w)}</span>`)
    .join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:1080px; height:1920px; overflow:hidden; }
    body {
      background: radial-gradient(120% 80% at 50% 10%, #2a1a6b 0%, #0b0b16 60%),
                  linear-gradient(160deg, #1E1B4B, #0E7490);
      font-family: 'Segoe UI', Arial, sans-serif;
      display:flex; align-items:center; justify-content:flex-start; flex-direction:column;
      padding:220px 110px; color:#fff;
      animation: drift 4s ease-out both;
    }
    .eyebrow {
      font-size:34px; font-weight:700; letter-spacing:.28em; text-transform:uppercase;
      color:#22D3EE; margin-bottom:48px; opacity:0;
      animation: fade .6s ease-out both; animation-delay:.1s;
    }
    .hook { font-size:128px; font-weight:800; line-height:1.04; letter-spacing:-.02em; max-width:860px; }
    .w { display:inline-block; opacity:0; transform:translateY(60px);
      animation: rise .62s cubic-bezier(.16,1,.3,1) both;
      animation-delay: calc(var(--i) * 0.11s + .25s); }
    .bar { width:240px; height:12px; border-radius:6px; margin-top:64px;
      background:linear-gradient(90deg,#A78BFA,#22D3EE); transform:scaleX(0); transform-origin:left;
      animation: grow .7s cubic-bezier(.16,1,.3,1) both; animation-delay:1.1s; }
    @keyframes rise { to { opacity:1; transform:none; } }
    @keyframes fade { to { opacity:1; } }
    @keyframes grow { to { transform:scaleX(1); } }
    @keyframes drift { from { transform:scale(1.06); } to { transform:scale(1); } }
  </style></head><body>
    <div class="eyebrow">Automation Myth</div>
    <div class="hook">${spans}</div>
    <div class="bar"></div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  // The render chain loads config/env — stub the required vars (this test
  // touches neither Supabase nor any LLM).
  process.env.INTERNAL_API_KEY ||= 'local-kinetic-test-key';
  process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key';

  const { captureKineticClip } = await import('../src/modules/motion/frameRenderer');
  const outPath = path.resolve(process.cwd(), '..', 'flux-kinetic-demo.mp4');
  // eslint-disable-next-line no-console
  console.log('Capturing kinetic clip ->', outPath);
  const res = await captureKineticClip({
    html: buildHtml(HOOK),
    width: 1080,
    height: 1920,
    fps: 30,
    durationSec: 2.6,
    outPath,
  });
  // eslint-disable-next-line no-console
  console.log('DONE:', JSON.stringify(res));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
