/**
 * Minimal-family HTML slide template.
 *
 *   - Pure typography. Backgrounds use brand colours / gradients.
 *   - All visual style comes from CSS custom properties bound to the
 *     resolved BrandTheme (colors + typography). One template, every theme.
 *   - Used for the system templates:
 *       carousel.educational.v1  -> htmlTemplate "minimal-carousel"
 *       single.quote.v1          -> htmlTemplate "minimal-quote"
 *       single.cta.v1            -> htmlTemplate "minimal-single"
 *
 *   - Layouts supported:
 *       title-hook · stat-callout · two-column-list · single-quote ·
 *       centered-quote · step · cta-action · title-cta · (fallback)
 */
import type { BrandProfile, SlideContent } from '../../../types';

/**
 * Optional style mode overlay — when supplied, its typography + palette
 * replace the brand theme defaults. Lets the studio's 40-mode picker
 * actually drive the renderer.
 */
export interface StyleModeOverlay {
  typography?: {
    primary?: string;
    display?: string;
    weight_body?: number;
    weight_display?: number;
    hook_size?: number;
    body_size?: number;
    tracking?: string;
  };
  palette?: {
    background?: string;
    foreground?: string;
    muted?: string;
    accent?: string;
    accent_soft?: string;
    gradient?: string[];
  };
  layout?: {
    padding?: 'tight' | 'standard' | 'generous' | 'luxurious';
    grid?: string;
  };
  effects?: {
    grain?: number;
    glow?: number;
    vignette?: number;
    blur?: number;
  };
}

export interface RenderSlideArgs {
  htmlTemplate: string;    // 'minimal-carousel' | 'minimal-quote' | 'minimal-single'
  layout: string;
  data: SlideContent['data'];
  brand: BrandProfile;
  width: number;
  height: number;
  slideIndex?: number;     // 0-based
  totalSlides?: number;
  styleMode?: StyleModeOverlay | null;
}

/* ------------------------------- helpers ------------------------------- */

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function s(d: SlideContent['data'], key: string, fallback = ''): string {
  const v = d[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.join(', ');
  return fallback;
}

function items(d: SlideContent['data'], key: string): string[] {
  const v = d[key];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') {
    return v
      .split(/[\n,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

/* ------------------------------- CSS ----------------------------------- */

function fontFamily(name: string | undefined, fallback: string): string {
  return `"${(name ?? fallback).replace(/"/g, '')}", ${fallback}`;
}

function baseCss(args: RenderSlideArgs): string {
  // The style mode overlay takes precedence over the brand theme. Brand still
  // wins for anything the style doesn't specify (logo/handle/etc.).
  const smTyp = args.styleMode?.typography ?? {};
  const smPal = args.styleMode?.palette ?? {};
  const smEffects = args.styleMode?.effects ?? {};

  const c = args.brand.theme.colors;
  const t = args.brand.theme.typography;
  const bg = smPal.background ?? c.background;
  const fg = smPal.foreground ?? c.foreground;
  const muted = smPal.muted ?? c.muted ?? c.foreground;
  const accent = smPal.accent ?? c.accent;
  const accentSoft = smPal.accent_soft ?? c.accentSoft ?? accent;
  const grad =
    Array.isArray(smPal.gradient) && smPal.gradient.length >= 2
      ? `linear-gradient(135deg, ${smPal.gradient.join(', ')})`
      : null;

  const fontDisplay = fontFamily(smTyp.display ?? t.fontDisplay, 'Inter, sans-serif');
  const fontPrimary = fontFamily(smTyp.primary ?? t.fontPrimary, 'Inter, sans-serif');
  const sizeHook = smTyp.hook_size ?? t.sizeHook ?? 88;
  const sizeBody = smTyp.body_size ?? t.sizeBody ?? 40;
  const weightDisplay = smTyp.weight_display ?? t.weightDisplay ?? 900;
  const weightBody = smTyp.weight_body ?? t.weightBody ?? 500;
  const tracking = smTyp.tracking ?? '-0.02em';

  const paddingMap = {
    tight: '64px 56px',
    standard: '90px 80px',
    generous: '120px 96px',
    luxurious: '160px 120px',
  } as const;
  const pad = paddingMap[args.styleMode?.layout?.padding ?? 'standard'];

  return `
    :root {
      --bg: ${bg};
      --fg: ${fg};
      --muted: ${muted};
      --accent: ${accent};
      --accent-soft: ${accentSoft};
      --font-display: ${fontDisplay};
      --font-primary: ${fontPrimary};
      --size-hook: ${sizeHook}px;
      --size-body: ${sizeBody}px;
      --weight-display: ${weightDisplay};
      --weight-body: ${weightBody};
      --tracking: ${tracking};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${args.width}px;
      height: ${args.height}px;
      background: ${grad ?? 'var(--bg)'};
      color: var(--fg);
      font-family: var(--font-primary);
      font-weight: var(--weight-body);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      position: relative;
    }
    ${smEffects.vignette ? `
    body::after {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${(smEffects.vignette ?? 0).toFixed(2)}) 100%);
      pointer-events: none;
    }` : ''}
    ${smEffects.grain ? `
    body::before {
      content: ''; position: absolute; inset: 0;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='${(smEffects.grain ?? 0).toFixed(2)}'/></svg>");
      mix-blend-mode: overlay;
      pointer-events: none;
    }` : ''}
    .slide {
      position: relative;
      width: 100%; height: 100%;
      padding: ${pad};
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      text-align: center;
      z-index: 1;
    }
    .slide.left { align-items: flex-start; text-align: left; }
    .hook {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: var(--size-hook);
      line-height: 1.04;
      letter-spacing: var(--tracking);
      text-transform: uppercase;
    }
    .title {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: 72px;
      line-height: 1.08;
      letter-spacing: -0.015em;
    }
    .body {
      font-family: var(--font-primary);
      font-weight: var(--weight-body);
      font-size: var(--size-body);
      line-height: 1.3;
      color: var(--muted);
      max-width: 86%;
    }
    .accent { color: var(--accent); }
    .badge {
      display: inline-block;
      padding: 14px 28px;
      background: var(--accent-soft);
      color: var(--accent);
      font-family: var(--font-primary);
      font-weight: 800;
      font-size: 28px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      border-radius: 999px;
    }
    .big-number {
      font-family: var(--font-display);
      font-weight: 900;
      font-size: 240px;
      line-height: 0.95;
      letter-spacing: -0.04em;
      color: var(--accent);
    }
    .list {
      list-style: none;
      padding: 0; margin: 40px 0 0 0;
      display: flex; flex-direction: column; gap: 28px;
      align-self: stretch;
    }
    .list li {
      display: flex; align-items: flex-start; gap: 28px;
      font-family: var(--font-primary);
      font-weight: 700;
      font-size: 46px;
      line-height: 1.18;
    }
    .list li::before {
      content: '';
      flex: 0 0 18px;
      width: 18px; height: 18px;
      margin-top: 22px;
      background: var(--accent);
      border-radius: 999px;
    }
    .quote-mark {
      font-family: var(--font-display);
      font-weight: 900;
      font-size: 220px;
      line-height: 0.8;
      color: var(--accent);
      margin-bottom: -40px;
    }
    .attribution {
      margin-top: 56px;
      font-family: var(--font-primary);
      font-weight: 600;
      font-size: 34px;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .cta-pill {
      display: inline-block;
      padding: 32px 56px;
      background: var(--accent);
      color: var(--bg);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 48px;
      border-radius: 999px;
      letter-spacing: -0.01em;
    }
    .handle {
      margin-top: 40px;
      font-family: var(--font-primary);
      font-weight: 600;
      font-size: 32px;
      color: var(--muted);
    }
    .pageIndicator {
      position: absolute;
      top: 56px; right: 64px;
      font-family: var(--font-primary);
      font-weight: 700;
      font-size: 26px;
      color: var(--muted);
      letter-spacing: 0.16em;
      opacity: 0.7;
    }
    .stack-md > * + * { margin-top: 36px; }
    .stack-lg > * + * { margin-top: 56px; }
  `;
}

/**
 * Build a Google Fonts URL that covers all the typefaces the 40 style modes
 * might use. We over-fetch slightly — but it's CSS, the browser caches, and
 * Puppeteer only loads once per render run.
 */
function fontLinkFor(args: RenderSlideArgs): string {
  // Pull the fonts the style mode + brand want.
  const wantedRaw: string[] = [];
  const smTyp = args.styleMode?.typography ?? {};
  if (smTyp.display) wantedRaw.push(String(smTyp.display));
  if (smTyp.primary) wantedRaw.push(String(smTyp.primary));
  if (args.brand.theme.typography.fontDisplay) wantedRaw.push(String(args.brand.theme.typography.fontDisplay));
  if (args.brand.theme.typography.fontPrimary) wantedRaw.push(String(args.brand.theme.typography.fontPrimary));

  const SYSTEM = new Set(['SF Pro Display', 'Helvetica', '-apple-system']);
  const wanted = new Set(
    wantedRaw
      .map((f) => f.replace(/"/g, '').trim())
      .filter((f) => f.length > 0 && !SYSTEM.has(f)),
  );
  // Always available defaults.
  wanted.add('Inter');
  wanted.add('Playfair Display');
  wanted.add('JetBrains Mono');
  // Add common style-mode fonts so any seeded mode renders correctly.
  wanted.add('Cormorant Garamond');
  wanted.add('EB Garamond');
  wanted.add('Space Grotesk');
  wanted.add('Bebas Neue');
  wanted.add('IBM Plex Mono');
  wanted.add('Roboto Slab');
  wanted.add('Roboto Condensed');
  wanted.add('Bodoni Moda');
  wanted.add('Noto Serif JP');

  const families = [...wanted]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800;900`)
    .join('&');
  return `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">
`;
}

/* ------------------------------- layouts ------------------------------- */

function bodyTitleHook(d: SlideContent['data']): string {
  const title = s(d, 'title');
  const subtitle = s(d, 'subtitle');
  return `
    <div class="stack-md">
      <div class="hook">${esc(title)}</div>
      ${subtitle ? `<div class="body">${esc(subtitle)}</div>` : ''}
    </div>
  `;
}

function bodyStatCallout(d: SlideContent['data']): string {
  const num = s(d, 'number');
  const title = s(d, 'title');
  const body = s(d, 'body');
  return `
    <div class="stack-lg">
      <div class="big-number">${esc(num)}</div>
      <div class="title">${esc(title)}</div>
      ${body ? `<div class="body">${esc(body)}</div>` : ''}
    </div>
  `;
}

function bodyList(d: SlideContent['data']): string {
  const title = s(d, 'title');
  const list = items(d, 'items');
  return `
    <div style="display:flex; flex-direction:column; align-items:flex-start; align-self:stretch; text-align:left;">
      <div class="title">${esc(title)}</div>
      <ul class="list">
        ${list.map((it) => `<li>${esc(it)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function bodyQuote(d: SlideContent['data']): string {
  const body = s(d, 'body');
  const attribution = s(d, 'attribution');
  return `
    <div class="stack-md">
      <div class="quote-mark">&ldquo;</div>
      <div class="title" style="font-style: italic;">${esc(body)}</div>
      ${attribution ? `<div class="attribution">— ${esc(attribution)}</div>` : ''}
    </div>
  `;
}

function bodyStep(d: SlideContent['data']): string {
  const step = s(d, 'step', 'STEP');
  const title = s(d, 'title');
  const body = s(d, 'body');
  return `
    <div class="stack-md">
      <div class="badge">${esc(step)}</div>
      <div class="title">${esc(title)}</div>
      ${body ? `<div class="body">${esc(body)}</div>` : ''}
    </div>
  `;
}

function bodyCta(d: SlideContent['data']): string {
  const title = s(d, 'title');
  const subtitle = s(d, 'subtitle');
  const cta = s(d, 'cta', 'Follow for more');
  const handle = s(d, 'handle');
  return `
    <div class="stack-lg">
      <div class="hook">${esc(title)}</div>
      ${subtitle ? `<div class="body">${esc(subtitle)}</div>` : ''}
      <div class="cta-pill">${esc(cta)}</div>
      ${handle ? `<div class="handle">${esc(handle)}</div>` : ''}
    </div>
  `;
}

function bodyDefault(d: SlideContent['data']): string {
  const title = s(d, 'title');
  const body = s(d, 'body');
  return `
    <div class="stack-md">
      ${title ? `<div class="title">${esc(title)}</div>` : ''}
      ${body ? `<div class="body">${esc(body)}</div>` : ''}
    </div>
  `;
}

/* ------------------------------- entry --------------------------------- */

export function renderSlide(args: RenderSlideArgs): string {
  let body: string;
  switch (args.layout) {
    case 'title-hook':
      body = bodyTitleHook(args.data);
      break;
    case 'stat-callout':
      body = bodyStatCallout(args.data);
      break;
    case 'two-column-list':
      body = bodyList(args.data);
      break;
    case 'single-quote':
    case 'centered-quote':
      body = bodyQuote(args.data);
      break;
    case 'step':
      body = bodyStep(args.data);
      break;
    case 'cta-action':
    case 'title-cta':
      body = bodyCta(args.data);
      break;
    default:
      body = bodyDefault(args.data);
  }

  const showIndicator =
    typeof args.slideIndex === 'number' &&
    typeof args.totalSlides === 'number' &&
    args.totalSlides > 1;

  const indicator = showIndicator
    ? `<div class="pageIndicator">${(args.slideIndex ?? 0) + 1} / ${args.totalSlides}</div>`
    : '';

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
${fontLinkFor(args)}
<style>${baseCss(args)}</style>
</head>
<body>
  <div class="slide${args.layout === 'two-column-list' ? ' left' : ''}">
    ${indicator}
    ${body}
  </div>
</body></html>`;
}
