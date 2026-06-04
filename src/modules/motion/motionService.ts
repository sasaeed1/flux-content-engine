/**
 * Motion service — orchestrates reel generation for a carousel:
 *
 *   carousel -> ordered render-slide URLs -> composeReel (ffmpeg) ->
 *   upload MP4 to the content-reels bucket -> generated_reels row.
 *
 * Generation is ASYNC: startReelGeneration() inserts a `processing` row and
 * returns immediately, then the render runs in the background and flips the
 * row to `ready` (or `failed`). The web UI polls GET /tenant/reels/:id. This
 * keeps the HTTP request fast and avoids any proxy/serverless timeout on the
 * ~60-90s ffmpeg render.
 *
 * The preset is inherited from the carousel's style mode (its motion DNA)
 * unless the caller overrides it. Tenant-scoped throughout.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { childLogger } from '../../lib/logger';
import { NotFoundError, ValidationError, toErrorMessage } from '../../lib/errors';
import { env } from '../../config/env';
import { supabase } from '../../lib/supabase';
import { uploadBuffer, storagePaths } from '../../lib/storage';
import {
  getCarouselByIdScoped,
  insertReel,
  listRenderAssetsForCarousel,
  updateReel,
} from '../../db/repositories';
import { composeReel } from './composer';
import { presetForStyleMotion, defaultPreset } from './presets';
import { REEL_DIMENSIONS } from './types';
import type { MotionPhilosophy, MotionPreset, ReelAspect } from './types';
import type { GeneratedCarouselRow, GeneratedReelRow, Json } from '../../types';

const log = childLogger({ module: 'motion:service' });

export interface GenerateReelInput {
  orgId: string;
  carouselId: string;
  /** Output aspect. Defaults to REEL_DEFAULT_ASPECT (9:16). */
  aspect?: ReelAspect;
  /** Explicit preset override (e.g. "motion-cinematic" or "kinetic"). */
  presetKey?: string;
}

/**
 * Validate + enqueue a reel render. Inserts a `processing` row and kicks the
 * ffmpeg render off in the background, returning the row immediately.
 */
export async function startReelGeneration(
  input: GenerateReelInput,
): Promise<GeneratedReelRow> {
  const { orgId, carouselId } = input;

  const carousel = await getCarouselByIdScoped(orgId, carouselId);
  if (!carousel) throw new NotFoundError(`Carousel ${carouselId} not found`);

  const sources = await resolveSlideSources(orgId, carousel);
  if (sources.length === 0) {
    throw new ValidationError(
      'Carousel has no rendered slides to animate — render the carousel first',
    );
  }

  const aspect: ReelAspect = input.aspect ?? env.REEL_DEFAULT_ASPECT;
  const preset = await resolvePreset(orgId, carousel, input.presetKey);
  const dims = REEL_DIMENSIONS[aspect];
  const reelId = randomUUID();

  const row = await insertReel({
    id: reelId,
    organization_id: orgId,
    carousel_id: carouselId,
    run_id: carousel.run_id ?? null,
    preset_key: preset.key,
    aspect,
    width: dims.width,
    height: dims.height,
    status: 'processing',
    metadata: { slideCount: sources.length, presetName: preset.name },
  });

  // Fire-and-forget — the render flips the row to ready/failed. Errors are
  // handled inside renderReel; the catch here only guards the unawaited promise.
  void renderReel(reelId, orgId, sources, preset, aspect).catch((err) => {
    log.error({ reelId, error: toErrorMessage(err) }, 'Background reel render rejected');
  });

  return row;
}

/** Background render: compose -> upload -> mark ready (or failed). */
async function renderReel(
  reelId: string,
  orgId: string,
  sources: string[],
  preset: MotionPreset,
  aspect: ReelAspect,
): Promise<void> {
  const tmpOut = path.join(os.tmpdir(), `flux-reel-${reelId}.mp4`);
  try {
    const slides = sources.map((source, index) => ({ index, source }));
    const result = await composeReel({ slides, preset, aspect, outPath: tmpOut });

    const body = fs.readFileSync(tmpOut);
    const storagePath = storagePaths.reel(orgId, reelId);
    const { publicUrl } = await uploadBuffer({
      bucket: env.SUPABASE_REEL_BUCKET,
      path: storagePath,
      body,
      contentType: 'video/mp4',
    });

    await updateReel(orgId, reelId, {
      status: 'ready',
      storage_path: storagePath,
      public_url: publicUrl,
      bytes: result.bytes,
      duration_sec: result.durationSec,
      fps: result.fps,
    });
    log.info({ reelId, bytes: result.bytes, durationSec: result.durationSec }, 'Reel ready');
  } catch (err) {
    const message = toErrorMessage(err);
    log.error({ reelId, error: message }, 'Reel render failed');
    try {
      await updateReel(orgId, reelId, {
        status: 'failed',
        metadata: { error: message } as Json,
      });
    } catch {
      /* swallow — best effort */
    }
  } finally {
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      /* best-effort temp cleanup */
    }
  }
}

/** Ordered slide image URLs for a carousel (render assets, then JSON fallback). */
async function resolveSlideSources(
  orgId: string,
  carousel: GeneratedCarouselRow,
): Promise<string[]> {
  const assets = await listRenderAssetsForCarousel(orgId, carousel.id);
  const fromAssets = assets
    .filter((a) => !!a.public_url)
    .sort((a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0))
    .map((a) => a.public_url as string);
  if (fromAssets.length > 0) return fromAssets;

  const slides = (carousel.slides as Array<{ imageUrl?: string }> | null) ?? [];
  return slides.map((s) => s.imageUrl).filter((u): u is string => !!u);
}

/** Pick the motion preset: explicit override > carousel's style DNA > default. */
async function resolvePreset(
  orgId: string,
  carousel: GeneratedCarouselRow,
  presetKey?: string,
): Promise<MotionPreset> {
  if (presetKey) {
    const philosophy = presetKey.replace(/^motion-/, '') as MotionPhilosophy;
    return presetForStyleMotion(philosophy, 0.55);
  }
  const styleKey = (carousel.metadata as { style_mode_key?: string } | null)?.style_mode_key;
  if (styleKey) {
    const motion = await loadStyleMotion(orgId, styleKey);
    if (motion) return presetForStyleMotion(motion.philosophy, motion.intensity);
  }
  return defaultPreset();
}

/** Fetch just the `motion` block of a style mode (loader omits it). */
async function loadStyleMotion(
  orgId: string,
  key: string,
): Promise<{ philosophy: MotionPhilosophy; intensity: number } | null> {
  const { data } = await supabase
    .from('style_modes')
    .select('motion')
    .eq('key', key)
    .or(`organization_id.eq.${orgId},organization_id.is.null`)
    .order('organization_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const motion = (data?.motion ?? null) as
    | { philosophy?: MotionPhilosophy; intensity?: number }
    | null;
  if (!motion?.philosophy) return null;
  return {
    philosophy: motion.philosophy,
    intensity: typeof motion.intensity === 'number' ? motion.intensity : 0.4,
  };
}
