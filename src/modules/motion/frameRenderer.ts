/**
 * Kinetic frame renderer — captures an animated HTML slide as a deterministic
 * PNG frame sequence (by stepping the Web Animations timeline headlessly), then
 * encodes it into a true kinetic-typography clip via ffmpeg.
 *
 * This is the premium motion path: real CSS-animated, on-brand text (not a
 * Ken Burns pan over a static image). It is heavier than the zoompan path —
 * one screenshot per frame — so callers opt in.
 */
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { childLogger } from '../../lib/logger';
import { getBrowser } from '../render/htmlRenderer';
import { runFfmpeg } from './ffmpeg';

const log = childLogger({ module: 'motion:frames' });

export interface KineticClipInput {
  /** Full HTML document with CSS @keyframes / Web Animations on the text. */
  html: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  /** Output clip path (.mp4). */
  outPath: string;
}

/**
 * Render `html` to a frame sequence by pausing every animation and stepping
 * its currentTime frame-by-frame, then encode the frames into an MP4 clip.
 */
export async function captureKineticClip(
  input: KineticClipInput,
): Promise<{ outPath: string; frames: number }> {
  const { html, width, height, fps, durationSec, outPath } = input;
  const browser = await getBrowser();
  const page = await browser.newPage();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'flux-kinetic-'));

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.evaluate('document.fonts.ready');
    // Freeze the timeline so we can sample it deterministically.
    await page.evaluate('document.getAnimations().forEach((a) => a.pause())');

    const total = Math.max(1, Math.round(fps * durationSec));
    for (let i = 0; i < total; i++) {
      const ms = (i / fps) * 1000;
      // Step every animation to this exact time, then grab the frame.
      await page.evaluate(`document.getAnimations().forEach((a) => { a.currentTime = ${ms}; })`);
      const shot = await page.screenshot({ type: 'png', omitBackground: false });
      const buf = Buffer.isBuffer(shot) ? shot : Buffer.from(shot as Uint8Array);
      await writeFile(path.join(dir, `f-${String(i).padStart(5, '0')}.png`), buf);
    }

    log.info({ frames: total, fps, outPath }, 'Frames captured — encoding kinetic clip');

    await runFfmpeg({
      args: [
        '-framerate',
        String(fps),
        '-i',
        path.join(dir, 'f-%05d.png'),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-movflags',
        '+faststart',
        outPath,
      ],
      label: 'kinetic-encode',
    });

    return { outPath, frames: total };
  } finally {
    await page.close().catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
