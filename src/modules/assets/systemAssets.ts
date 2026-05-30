/**
 * System asset library — Phase 3 post-audit #3.
 *
 * Style modes reference overlay names like 'islamic-geometric', 'crt-scanlines',
 * etc. but until now those names resolved to nothing. This module provides:
 *
 *   - A registry of code-backed system overlays (SVG patterns rendered at
 *     0 cost — no PNG storage hit, no CDN dependency, perfectly deterministic).
 *   - A loader the renderer uses to embed the overlay as a data URL inside
 *     the slide's CSS background-image.
 *   - A boot seeder that registers asset_library rows so the eventual
 *     "Asset Browser" UI can list everything available.
 *
 * Why SVG and not bitmaps?
 *   - Deterministic — same input → same pixels. Honors the architectural
 *     commitment of pure-function rendering.
 *   - Free — zero storage bytes, zero bandwidth.
 *   - Scalable — same overlay works at 1080×1080 or 1080×1920 (future reels).
 *
 * Future expansion: a per-org custom asset upload path will store user-
 * uploaded PNGs in Storage and add their rows to the same table. The loader
 * already supports the public_url fallback.
 */

export type AssetKind = 'overlay' | 'texture' | 'gradient' | 'motion-preset' | 'icon-pack';

export interface SystemAsset {
  key: string;
  kind: AssetKind;
  name: string;
  /** CSS opacity hint for the renderer. */
  opacity?: number;
  /** CSS mix-blend-mode hint. */
  blendMode?: string;
  /** Raw SVG body — wrapped with <svg> by `inlineSvg()`. */
  svgBody: string;
  /** Optional viewBox override (defaults to "0 0 200 200"). */
  viewBox?: string;
  /** Optional CSS background-size override (defaults to "200px 200px"). */
  tileSize?: string;
}

/**
 * 12 system overlays + textures. Names match the references in styleModes.ts
 * plus a handful of common patterns that match modes like swiss-design-grid,
 * cyberpunk-neon, brutalist-editorial, etc.
 *
 * Every overlay uses two-tone CSS so the renderer can layer it over any
 * palette — they're meant to be applied with mix-blend-mode: overlay or
 * soft-light at low opacity.
 */
export const SYSTEM_ASSETS: SystemAsset[] = [
  {
    key: 'islamic-geometric',
    kind: 'overlay',
    name: 'Islamic geometric',
    opacity: 0.10,
    blendMode: 'overlay',
    tileSize: '160px 160px',
    viewBox: '0 0 160 160',
    svgBody: `
      <defs>
        <pattern id="iz" patternUnits="userSpaceOnUse" width="160" height="160">
          <g fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="80" cy="80" r="60"/>
            <circle cx="80" cy="80" r="40"/>
            <polygon points="80,20 138,80 80,138 22,80"/>
            <polygon points="80,20 110,50 138,80 110,110 80,138 50,110 22,80 50,50" stroke-opacity="0.6"/>
            <line x1="0" y1="80" x2="160" y2="80"/>
            <line x1="80" y1="0" x2="80" y2="160"/>
            <line x1="0" y1="0" x2="160" y2="160" stroke-opacity="0.5"/>
            <line x1="160" y1="0" x2="0" y2="160" stroke-opacity="0.5"/>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#iz)"/>
    `,
  },
  {
    key: 'crt-scanlines',
    kind: 'overlay',
    name: 'CRT scanlines',
    opacity: 0.28,
    blendMode: 'soft-light',
    tileSize: '100% 4px',
    viewBox: '0 0 1 4',
    svgBody: `
      <rect width="1" height="2" fill="currentColor" opacity="0.6"/>
      <rect y="2" width="1" height="2" fill="transparent"/>
    `,
  },
  {
    key: 'swiss-grid',
    kind: 'overlay',
    name: 'Swiss grid',
    opacity: 0.18,
    blendMode: 'overlay',
    tileSize: '80px 80px',
    viewBox: '0 0 80 80',
    svgBody: `
      <g fill="none" stroke="currentColor" stroke-width="0.6">
        <line x1="0" y1="0" x2="80" y2="0"/>
        <line x1="0" y1="0" x2="0" y2="80"/>
        <line x1="40" y1="0" x2="40" y2="80" stroke-opacity="0.4"/>
        <line x1="0" y1="40" x2="80" y2="40" stroke-opacity="0.4"/>
      </g>
    `,
  },
  {
    key: 'dotted-grid',
    kind: 'overlay',
    name: 'Dotted grid',
    opacity: 0.22,
    blendMode: 'overlay',
    tileSize: '32px 32px',
    viewBox: '0 0 32 32',
    svgBody: `<circle cx="2" cy="2" r="1.1" fill="currentColor"/>`,
  },
  {
    key: 'diagonal-lines',
    kind: 'overlay',
    name: 'Diagonal pinstripes',
    opacity: 0.16,
    blendMode: 'overlay',
    tileSize: '24px 24px',
    viewBox: '0 0 24 24',
    svgBody: `<g stroke="currentColor" stroke-width="0.8"><line x1="0" y1="24" x2="24" y2="0"/></g>`,
  },
  {
    key: 'halftone',
    kind: 'texture',
    name: 'Halftone dots',
    opacity: 0.18,
    blendMode: 'multiply',
    tileSize: '12px 12px',
    viewBox: '0 0 12 12',
    svgBody: `
      <g fill="currentColor">
        <circle cx="3" cy="3" r="1.8"/>
        <circle cx="9" cy="9" r="1.8"/>
        <circle cx="9" cy="3" r="1.2" opacity="0.6"/>
        <circle cx="3" cy="9" r="1.2" opacity="0.6"/>
      </g>
    `,
  },
  {
    key: 'paper-noise',
    kind: 'texture',
    name: 'Paper noise',
    opacity: 0.15,
    blendMode: 'overlay',
    tileSize: '200px 200px',
    viewBox: '0 0 200 200',
    svgBody: `
      <defs>
        <filter id="pn">
          <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#pn)"/>
    `,
  },
  {
    key: 'topographic',
    kind: 'overlay',
    name: 'Topographic contours',
    opacity: 0.18,
    blendMode: 'overlay',
    tileSize: '300px 300px',
    viewBox: '0 0 300 300',
    svgBody: `
      <g fill="none" stroke="currentColor" stroke-width="0.8">
        <path d="M0,50 Q75,30 150,55 T300,40"/>
        <path d="M0,100 Q75,80 150,105 T300,95"/>
        <path d="M0,160 Q75,140 150,170 T300,155"/>
        <path d="M0,210 Q75,195 150,225 T300,215"/>
        <path d="M0,260 Q75,245 150,275 T300,270"/>
      </g>
    `,
  },
  {
    key: 'holographic-noise',
    kind: 'texture',
    name: 'Holographic shimmer',
    opacity: 0.22,
    blendMode: 'screen',
    tileSize: '400px 400px',
    viewBox: '0 0 400 400',
    svgBody: `
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#A78BFA"/>
          <stop offset="0.33" stop-color="#22D3EE"/>
          <stop offset="0.66" stop-color="#EC4899"/>
          <stop offset="1" stop-color="#F59E0B"/>
        </linearGradient>
        <filter id="hn"><feTurbulence baseFrequency="0.6" numOctaves="2"/><feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.7  0 0 0 0 0.7  0 0 0 0.35 0"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#hg)" opacity="0.45"/>
      <rect width="100%" height="100%" filter="url(#hn)"/>
    `,
  },
  {
    key: 'metallic-brushed',
    kind: 'texture',
    name: 'Brushed metal',
    opacity: 0.20,
    blendMode: 'overlay',
    tileSize: '400px 400px',
    viewBox: '0 0 400 400',
    svgBody: `
      <defs>
        <filter id="bm">
          <feTurbulence baseFrequency="0.02 1.8" numOctaves="1" seed="9"/>
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.45 0"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#bm)"/>
    `,
  },
  {
    key: 'film-grain-heavy',
    kind: 'texture',
    name: 'Film grain (heavy)',
    opacity: 0.42,
    blendMode: 'soft-light',
    tileSize: '180px 180px',
    viewBox: '0 0 180 180',
    svgBody: `
      <defs>
        <filter id="fg"><feTurbulence baseFrequency="1.4" numOctaves="3" seed="11"/></filter>
      </defs>
      <rect width="100%" height="100%" filter="url(#fg)"/>
    `,
  },
  {
    key: 'glow-soft',
    kind: 'gradient',
    name: 'Soft radial glow',
    opacity: 0.55,
    blendMode: 'screen',
    tileSize: '100% 100%',
    viewBox: '0 0 200 200',
    svgBody: `
      <defs>
        <radialGradient id="gs" cx="50%" cy="35%" r="55%">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.85"/>
          <stop offset="0.6" stop-color="currentColor" stop-opacity="0.18"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#gs)"/>
    `,
  },
];

const ASSET_INDEX: Map<string, SystemAsset> = new Map(SYSTEM_ASSETS.map((a) => [a.key, a]));

/** Resolve a system asset by key (case-insensitive). Returns null when unknown. */
export function findSystemAsset(key: string): SystemAsset | null {
  if (!key) return null;
  return ASSET_INDEX.get(key) ?? ASSET_INDEX.get(key.toLowerCase()) ?? null;
}

/**
 * Wrap a body fragment into a full SVG string ready for inlining.
 * Color defaults to currentColor so the CSS `color` rule controls tint —
 * use the renderer's `--accent` or `--fg` to drive the overlay tone.
 */
export function inlineSvg(asset: SystemAsset): string {
  const viewBox = asset.viewBox ?? '0 0 200 200';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${asset.svgBody}</svg>`;
}

/** Produces a CSS-ready data URL for the SVG. */
export function asDataUrl(asset: SystemAsset): string {
  const svg = inlineSvg(asset).replace(/\n\s+/g, ' ').trim();
  // encodeURIComponent gives us a safe URL with no base64 overhead.
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

/**
 * Convenience: produce the full CSS rule fragment for the overlay layer.
 * Returns null if the asset key is unknown — the renderer treats null as
 * "skip this layer".
 */
export interface OverlayCss {
  backgroundImage: string;
  backgroundSize: string;
  opacity: number;
  mixBlendMode: string;
}

export function buildOverlayCss(key: string | null | undefined): OverlayCss | null {
  if (!key) return null;
  const asset = findSystemAsset(key);
  if (!asset) return null;
  return {
    backgroundImage: asDataUrl(asset),
    backgroundSize: asset.tileSize ?? '200px 200px',
    opacity: asset.opacity ?? 0.2,
    mixBlendMode: asset.blendMode ?? 'overlay',
  };
}
