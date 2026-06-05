/**
 * Image intelligence — deterministic, CPU-only quality analysis via sharp
 * (libvips). The foundation of the AI Media Intelligence Studio (Module 1):
 * every uploaded image is scored so the studio can rank assets, surface the
 * best ones, and tell the AI creative director what it's working with.
 *
 * All metrics derive from sharp.stats() + metadata — no GPU, no API cost.
 */
import sharp from 'sharp';

export interface ImageScores {
  /** 0..100 — higher = sharper (low = blurry/soft). */
  sharpness: number;
  /** 0..100 — exposure quality (penalises too dark / too bright). */
  exposure: number;
  /** 0..100 — tonal contrast / punch. */
  contrast: number;
  /** 0..100 — resolution adequacy for social. */
  resolution: number;
  /** 0..100 — framing: standard social aspect + visual detail. */
  composition: number;
  /** 0..100 — overall social-media suitability (weighted blend). */
  social: number;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: number;
  bytes: number;
  format: string;
  brightness: number; // raw mean luma 0..255
  dominantColor: string; // hex
  scores: ImageScores;
  /** Human-readable issues a creative director would flag. */
  flags: string[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Reward standard social aspect ratios; penalise odd crops. Returns 0..100. */
function aspectScore(ar: number): number {
  const targets = [1, 0.8, 0.5625, 1.7778, 1.91]; // 1:1, 4:5, 9:16, 16:9, 1.91:1
  const closest = targets.reduce(
    (best, t) => Math.min(best, Math.abs(ar - t) / t),
    Number.POSITIVE_INFINITY,
  );
  return clamp(100 - closest * 220);
}

function toHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
  const img = sharp(buffer, { failOn: 'none' });
  const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const megapixels = (width * height) / 1e6;
  const aspect = height ? width / height : 1;

  const rgb = stats.channels.slice(0, 3);
  const brightness = rgb.reduce((a, c) => a + c.mean, 0) / Math.max(1, rgb.length);
  const contrastRaw = rgb.reduce((a, c) => a + c.stdev, 0) / Math.max(1, rgb.length);
  // sharp's stats() exposes `sharpness` + `entropy` (not in older typings).
  const s = stats as unknown as { sharpness?: number; entropy?: number; dominant?: { r: number; g: number; b: number } };
  const sharpnessRaw = s.sharpness ?? 0;
  const entropy = s.entropy ?? 4;
  const dominant = s.dominant ?? { r: 128, g: 128, b: 128 };

  const sharpness = clamp((sharpnessRaw / 12) * 100); // ~12 reads as crisp
  const exposure = clamp(100 - (Math.abs(brightness - 128) / 128) * 120);
  const contrast = clamp((contrastRaw / 60) * 100); // ~60 stdev = punchy
  const resolution = clamp((megapixels / 2) * 100); // 2MP = full marks
  const detail = clamp((entropy / 7) * 100);
  const composition = clamp(aspectScore(aspect) * 0.6 + detail * 0.4);
  const social = clamp(
    sharpness * 0.3 + exposure * 0.25 + contrast * 0.15 + resolution * 0.2 + composition * 0.1,
  );

  const flags: string[] = [];
  if (sharpness < 45) flags.push('soft / possibly blurry');
  if (brightness < 70) flags.push('underexposed');
  if (brightness > 195) flags.push('overexposed / washed out');
  if (megapixels < 0.8) flags.push('low resolution for social');
  if (aspectScore(aspect) < 50) flags.push('unusual aspect ratio');
  if (contrast < 30) flags.push('flat / low contrast');

  return {
    width,
    height,
    megapixels: r2(megapixels),
    aspectRatio: r2(aspect),
    bytes: meta.size ?? buffer.length,
    format: meta.format ?? 'unknown',
    brightness: r0(brightness),
    dominantColor: toHex(dominant),
    scores: {
      sharpness: r0(sharpness),
      exposure: r0(exposure),
      contrast: r0(contrast),
      resolution: r0(resolution),
      composition: r0(composition),
      social: r0(social),
    },
    flags,
  };
}
