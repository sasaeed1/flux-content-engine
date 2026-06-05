/**
 * Smart reframing (Module 3 slice) — auto-crop an image to each social aspect
 * ratio using libvips attention-based smart-crop (sharp.strategy.attention),
 * which keeps the most salient region (faces / edges / saturation) in frame.
 * One upload → 1:1, 4:5, 9:16 (and link) crops, subject-aware. CPU-only, free.
 */
import sharp from 'sharp';

export interface ReframeSpec {
  w: number;
  h: number;
  label: string;
}

export const REFRAME_ASPECTS: Record<string, ReframeSpec> = {
  square: { w: 1080, h: 1080, label: '1:1 Square' },
  portrait: { w: 1080, h: 1350, label: '4:5 Portrait' },
  story: { w: 1080, h: 1920, label: '9:16 Story / Reel' },
  landscape: { w: 1200, h: 628, label: '1.91:1 Link' },
};

export const DEFAULT_REFRAME_KEYS = ['square', 'portrait', 'story'];

export async function smartCrop(
  buffer: Buffer,
  key: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const target = REFRAME_ASPECTS[key];
  if (!target) throw new Error(`Unknown reframe aspect: ${key}`);
  const out = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: target.w,
      height: target.h,
      fit: 'cover',
      position: sharp.strategy.attention, // libvips smart-crop toward the subject
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}
