/**
 * Layout-aware backgrounds + readability optimization (Module 3) — turn a photo
 * into text-ready slide backgrounds. Smart-crops to 4:5 (carousel slide), applies
 * a treatment (scrim / frost / duotone), then composites a bottom→top gradient
 * scrim so overlaid captions stay legible. All via sharp — CPU-only, no deps.
 */
import sharp from 'sharp';

const W = 1080;
const H = 1350; // 4:5 — the carousel slide canvas

export const BACKGROUND_STYLES = ['scrim', 'frost', 'duotone'] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];
export const DEFAULT_BACKGROUND_STYLES: string[] = ['scrim', 'frost', 'duotone'];

function hexToRgb(hex?: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export async function makeBackground(
  buffer: Buffer,
  style: string,
  brandColor?: string | null,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  let base = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: W, height: H, fit: 'cover', position: sharp.strategy.attention });

  if (style === 'frost') {
    base = base.blur(18).modulate({ brightness: 0.82 });
  } else if (style === 'duotone') {
    const rgb = hexToRgb(brandColor) ?? { r: 88, g: 64, b: 212 };
    base = base.grayscale().tint(rgb).modulate({ brightness: 0.96 });
  } else {
    base = base.modulate({ brightness: 0.9 }); // scrim — gentle darken
  }

  const rendered = await base.jpeg({ quality: 88, mozjpeg: true }).toBuffer();

  // Bottom→top readability gradient (text sits in the lower third).
  const svg = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0.35" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000" stop-opacity="0.72"/>` +
      `</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`,
  );
  const out = await sharp(rendered)
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}
