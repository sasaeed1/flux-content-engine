/**
 * Motion composer — turns rendered slide PNGs into a cinematic MP4 reel
 * using a pure ffmpeg filtergraph:
 *
 *   per slide:  cover-crop -> Ken Burns (zoompan)
 *   join:       xfade transitions between consecutive clips
 *   finish:     vignette + film grain
 *
 * Zero API cost, zero GPU. Runs anywhere ffmpeg-static runs.
 *
 * Remote sources are downloaded to local temp files before rendering — the
 * bundled static ffmpeg can segfault on https inputs in some container builds,
 * and local files are faster + more reliable anyway.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { childLogger } from '../../lib/logger';
import { ExternalApiError, ValidationError } from '../../lib/errors';
import { runFfmpeg } from './ffmpeg';
import { REEL_DIMENSIONS } from './types';
import type { ReelRenderInput, ReelRenderResult, TransitionKind, ZoomDirection } from './types';

const log = childLogger({ module: 'motion:composer' });

/** Supersample factor for the Ken Burns source. 1x keeps zoompan fast — it
 *  already up-samples its crop window, so gradients/photos stay smooth. Bump
 *  to 2x only when a render needs extra crispness (≈4x the cost). */
const SUPERSAMPLE = 1;

interface LocalizedSources {
  paths: string[];
  cleanup: () => Promise<void>;
}

/** Download any http(s) sources to local temp files; pass local paths through. */
async function localizeSources(sources: string[]): Promise<LocalizedSources> {
  const needsDownload = sources.some((s) => /^https?:\/\//i.test(s));
  if (!needsDownload) {
    return { paths: sources, cleanup: async () => {} };
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'flux-reel-src-'));
  const paths: string[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    if (!/^https?:\/\//i.test(src)) {
      paths.push(src);
      continue;
    }
    const res = await fetch(src);
    if (!res.ok) {
      throw new ExternalApiError('storage', `fetch slide ${i} failed: ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(dir, `slide-${i}.png`);
    await writeFile(dest, buf);
    paths.push(dest);
  }
  return {
    paths,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function composeReel(input: ReelRenderInput): Promise<ReelRenderResult> {
  const slides = [...input.slides].sort((a, b) => a.index - b.index);
  if (slides.length === 0) {
    throw new ValidationError('composeReel: at least one slide is required');
  }

  const { width: W, height: H } = REEL_DIMENSIONS[input.aspect];
  const p = input.preset;
  const fps = Math.max(12, Math.round(p.fps));
  const frames = Math.max(2, Math.round(p.slideDurationSec * fps));
  // Never let the transition eat more than 60% of a slide's hold time.
  const transitionSec = Math.min(p.transitionSec, p.slideDurationSec * 0.6);

  const outPath = input.outPath ?? path.join(os.tmpdir(), `flux-reel-${randomUUID()}.mp4`);

  // Pull remote slides local first (static ffmpeg segfaults on https inputs).
  const { paths: localPaths, cleanup } = await localizeSources(slides.map((s) => s.source));

  try {
    // One -i per slide.
    const inputs: string[] = [];
    for (const lp of localPaths) inputs.push('-i', lp);

    const sw = W * SUPERSAMPLE;
    const sh = H * SUPERSAMPLE;
    const parts: string[] = [];

    // ---- per-slide Ken Burns clips ----
    slides.forEach((s, i) => {
      const { z, x, y } = kenBurns(p.zoom, p.zoomIntensity, frames);
      parts.push(
        `[${i}:v]scale=${sw}:${sh}:force_original_aspect_ratio=increase,` +
          `crop=${sw}:${sh},` +
          `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:fps=${fps}:s=${W}x${H},` +
          `setsar=1,format=yuv420p[v${i}]`,
      );
    });

    // ---- join consecutive clips with xfade (or a single clip passthrough) ----
    const n = slides.length;
    let lastLabel: string;
    if (n === 1) {
      lastLabel = 'v0';
    } else {
      const transition = safeTransition(p.transition);
      let prev = 'v0';
      for (let i = 1; i < n; i++) {
        const out = i === n - 1 ? 'vx' : `x${i}`;
        const offset = round3(i * (p.slideDurationSec - transitionSec));
        parts.push(
          `[${prev}][v${i}]xfade=transition=${transition}:` +
            `duration=${round3(transitionSec)}:offset=${offset}[${out}]`,
        );
        prev = out;
      }
      lastLabel = 'vx';
    }

    // ---- grain + vignette finish ----
    const finish: string[] = [];
    if (p.vignette > 0.05) {
      const angle = (Math.PI / 5) * (0.5 + clamp01(p.vignette));
      finish.push(`vignette=angle=${angle.toFixed(4)}`);
    }
    if (p.grain > 0.02) {
      finish.push(`noise=alls=${Math.round(clamp01(p.grain) * 28)}:allf=t`);
    }
    finish.push('format=yuv420p');
    parts.push(`[${lastLabel}]${finish.join(',')}[vout]`);

    const filtergraph = parts.join(';');
    const totalDurationSec = round3(n * p.slideDurationSec - (n - 1) * transitionSec);

    const args = [
      ...inputs,
      '-filter_complex',
      filtergraph,
      '-map',
      '[vout]',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      // Cap the bitrate so grain/motion never bloat the file — keeps reels
      // upload-friendly (~8 Mbps => ~8 MB for a 8s reel, ~30 MB for 30s).
      '-maxrate',
      '8M',
      '-bufsize',
      '16M',
      '-r',
      String(fps),
      '-movflags',
      '+faststart',
      outPath,
    ];

    log.info(
      { slides: n, aspect: input.aspect, preset: p.key, durationSec: totalDurationSec },
      'Composing reel',
    );

    await runFfmpeg({
      args,
      totalDurationSec,
      label: `reel:${p.key}`,
      // Generous budget: ~12s of wall-clock per second of output, min 2 min.
      timeoutMs: Math.max(120_000, Math.round(totalDurationSec * 1000 * 12)),
    });

    const { size } = fs.statSync(outPath);
    log.info({ outPath, bytes: size, durationSec: totalDurationSec }, 'Reel composed');

    return {
      outPath,
      width: W,
      height: H,
      durationSec: totalDurationSec,
      fps,
      bytes: size,
      presetKey: p.key,
    };
  } finally {
    await cleanup();
  }
}

/**
 * Crossfade two pre-rendered clips into one (used to prepend a kinetic intro
 * to a Ken Burns reel). Both clips are normalised to the same fps/size/sar.
 */
export async function concatWithXfade(opts: {
  clipA: string;
  clipB: string;
  aDurationSec: number;
  transitionSec: number;
  width: number;
  height: number;
  fps: number;
  outPath: string;
}): Promise<void> {
  const td = Math.max(0.2, opts.transitionSec);
  const offset = round3(Math.max(0.1, opts.aDurationSec - td));
  const fc =
    `[0:v]fps=${opts.fps},scale=${opts.width}:${opts.height},setsar=1,format=yuv420p[a];` +
    `[1:v]fps=${opts.fps},scale=${opts.width}:${opts.height},setsar=1,format=yuv420p[b];` +
    `[a][b]xfade=transition=fade:duration=${round3(td)}:offset=${offset}[v]`;
  await runFfmpeg({
    args: [
      '-i',
      opts.clipA,
      '-i',
      opts.clipB,
      '-filter_complex',
      fc,
      '-map',
      '[v]',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-maxrate',
      '8M',
      '-bufsize',
      '16M',
      '-r',
      String(opts.fps),
      '-movflags',
      '+faststart',
      opts.outPath,
    ],
    label: 'reel:concat',
  });
}

/**
 * Build the zoompan z/x/y expressions for a Ken Burns move. Expressions use
 * the output frame index `on` for deterministic, drift-free linear motion.
 */
function kenBurns(
  zoom: ZoomDirection,
  intensity: number,
  frames: number,
): { z: string; x: string; y: string } {
  const extra = (0.35 * clamp01(intensity)).toFixed(4); // up to +35% zoom travel
  const zMax = (1 + Number(extra)).toFixed(4);
  const denom = Math.max(frames - 1, 1);
  const prog = `on/${denom}`; // 0..1 across the clip

  const cx = `iw/2-(iw/zoom/2)`; // centered window (x)
  const cy = `ih/2-(ih/zoom/2)`; // centered window (y)
  const panX = `(iw-iw/zoom)`; // horizontal travel range

  switch (zoom) {
    case 'out':
      return { z: `${zMax}-${extra}*${prog}`, x: cx, y: cy };
    case 'in-pan-right':
      return { z: `1+${extra}*${prog}`, x: `${panX}*${prog}`, y: cy };
    case 'in-pan-left':
      return { z: `1+${extra}*${prog}`, x: `${panX}*(1-${prog})`, y: cy };
    case 'none':
      return { z: `1`, x: cx, y: cy };
    case 'in':
    default:
      return { z: `1+${extra}*${prog}`, x: cx, y: cy };
  }
}

function safeTransition(t: TransitionKind): string {
  return t === 'none' ? 'fade' : t;
}
function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
