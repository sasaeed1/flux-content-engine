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

export interface RenderSlideArgs {
  htmlTemplate: string;    // 'minimal-carousel' | 'minimal-quote' | 'minimal-single'
  layout: string;
  data: SlideContent['data'];
  brand: BrandProfile;
  width: number;
  height: number;
  slideIndex?: number;     // 0-based
  totalSlides?: number;
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
  const c = args.brand.theme.colors;
  const t = args.brand.theme.typography;
  const fontDisplay = fontFamily(t.fontDisplay, 'Inter, sans-serif');
  const fontPrimary = fontFamily(t.fontPrimary, 'Inter, sans-serif');
  const accentSoft = c.accentSoft ?? c.accent;

  return `
    :root {
      --bg: ${c.background};
      --fg: ${c.foreground};
      --muted: ${c.muted ?? c.foreground};
      --accent: ${c.accent};
      --accent-soft: ${accentSoft};
      --font-display: ${fontDisplay};
      --font-primary: ${fontPrimary};
      --size-hook: ${t.sizeHook ?? 88}px;
      --size-body: ${t.sizeBody ?? 40}px;
      --weight-display: ${t.weightDisplay ?? 900};
      --weight-body: ${t.weightBody ?? 500};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${args.width}px;
      height: ${args.height}px;
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-primary);
      font-weight: var(--weight-body);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .slide {
      position: relative;
      width: 100%; height: 100%;
      padding: 90px 80px;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      text-align: center;
    }
    .slide.left { align-items: flex-start; text-align: left; }
    .hook {
      font-family: var(--font-display);
      font-weight: var(--weight-display);
      font-size: var(--size-hook);
      line-height: 1.04;
      letter-spacing: -0.02em;
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

const FONT_LINK = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
`;

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
${FONT_LINK}
<style>${baseCss(args)}</style>
</head>
<body>
  <div class="slide${args.layout === 'two-column-list' ? ' left' : ''}">
    ${indicator}
    ${body}
  </div>
</body></html>`;
}
