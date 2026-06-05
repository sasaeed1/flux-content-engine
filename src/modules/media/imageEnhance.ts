/**
 * Image enhancement (Module 2 slice) — deterministic, CPU-only, driven by the
 * analysis. Lifts dark images, tames blown highlights, stretches flat contrast,
 * sharpens soft shots, optionally upscales small ones, and applies a subtle
 * brand colour grade. All via sharp (libvips) — no GPU, no API cost.
 */
import sharp from 'sharp';
import type { ImageAnalysis } from './imageIntelligence';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export interface EnhanceOptions {
  /** Upscale small images toward targetWidth using Lanczos. */
  upscale?: boolean;
  targetWidth?: number;
  /** Subtle brand colour grade (hex). */
  brandColor?: string | null;
  /** Overall strength 0..1. */
  intensity?: number;
}

export interface EnhanceResult {
  buffer: Buffer;
  width: number;
  height: number;
  /** Operations applied — surfaced to the user as "what the studio did". */
  applied: string[];
}

export async function enhanceImage(
  input: Buffer,
  analysis: ImageAnalysis,
  opts: EnhanceOptions = {},
): Promise<EnhanceResult> {
  const strength = clamp01(opts.intensity ?? 0.8);
  const applied: string[] = [];
  let pipe = sharp(input, { failOn: 'none' }).rotate(); // auto-orient from EXIF

  // 1. Auto-tone — lift shadows / tame highlights, gentle saturation lift.
  const b = analysis.brightness;
  let brightnessMul = 1;
  if (b < 95) {
    brightnessMul = 1 + Math.min(0.35, (95 - b) / 200) * strength;
    applied.push('brightened');
  } else if (b > 175) {
    brightnessMul = 1 - Math.min(0.22, (b - 175) / 280) * strength;
    applied.push('exposure tamed');
  }
  const satMul = 1 + (analysis.scores.contrast < 45 ? 0.18 : 0.08) * strength;
  pipe = pipe.modulate({ brightness: brightnessMul, saturation: satMul });
  applied.push('auto colour-corrected');

  // 2. Contrast stretch for flat images.
  if (analysis.scores.contrast < 55) {
    pipe = pipe.normalise();
    applied.push('contrast stretched');
  }

  // 3. Sharpen soft images.
  if (analysis.scores.sharpness < 62) {
    pipe = pipe.sharpen({ sigma: 1 + strength });
    applied.push('sharpened');
  }

  // 4. Optional upscale (Lanczos).
  const target = opts.targetWidth ?? 1600;
  if (opts.upscale && analysis.width > 0 && analysis.width < target) {
    pipe = pipe.resize({ width: target, kernel: 'lanczos3' });
    applied.push(`upscaled → ${target}px`);
  }

  // Render so an optional grade can composite at the final dimensions.
  let { data, info } = await pipe.jpeg({ quality: 92, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  // 5. Optional subtle brand colour grade (soft-light overlay).
  const rgb = opts.brandColor ? hexToRgb(opts.brandColor) : null;
  if (rgb) {
    const overlay = await sharp({
      create: {
        width: info.width,
        height: info.height,
        channels: 4,
        background: { ...rgb, alpha: 0.14 * strength },
      },
    })
      .png()
      .toBuffer();
    const graded = await sharp(data)
      .composite([{ input: overlay, blend: 'soft-light' }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    data = graded.data;
    info = graded.info;
    applied.push('brand grade');
  }

  return { buffer: data, width: info.width, height: info.height, applied };
}
