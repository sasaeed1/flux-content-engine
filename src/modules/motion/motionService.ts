/**
 * Motion service — orchestrates reel generation for a carousel:
 *
 *   carousel -> ordered render-slide URLs -> composeReel (ffmpeg) ->
 *   [optional kinetic hook intro, crossfaded on the front] ->
 *   upload MP4 to the content-reels bucket -> generated_reels row.
 *
 * Generation is ASYNC: startReelGeneration() inserts a `processing` row and
 * returns immediately; the render runs in the background and flips the row to
 * `ready` (or `failed`). The web UI polls GET /tenant/reels/:id.
 *
 * The preset is inherited from the carousel's style mode (its motion DNA)
 * unless overridden. Tenant-scoped throughout.
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
import { composeReel, concatWithXfade } from './composer';
import { captureKineticClip } from './frameRenderer';
import { kineticHookHtml } from './kineticTemplates';
import { presetForStyleMotion, defaultPreset } from './presets';
import { REEL_DIMENSIONS } from './types';
import type { MotionPhilosophy, MotionPreset, ReelAspect } from './types';
import type { GeneratedCarouselRow, GeneratedReelRow, Json } from '../../types';

const log = childLogger({ module: 'motion:service' });

/** Seconds the kinetic hook intro card runs before crossfading into the body. */
const KINETIC_INTRO_SEC = 2.6;
const KINETIC_TRANSITION_SEC = 0.5;

export interface GenerateReelInput {
  orgId: string;
  carouselId: string;
  /** Output aspect. Defaults to REEL_DEFAULT_ASPECT (9:16). */
  aspect?: ReelAspect;
  /** Explicit preset override (e.g. "motion-cinematic" or "kinetic"). */
  presetKey?: string;
  /** Prepend an animated-text kinetic hook intro card. Slower (Puppeteer). */
  kinetic?: boolean;
}

/**
 * Validate + enqueue a reel render. Inserts a `processing` row and kicks the
 * render off in the background, returning the row immediately.
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
  const hook = (carousel.hook ?? carousel.title ?? '').toString().trim();
  const kinetic = input.kinetic === true && hook.length > 0;

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
    metadata: { slideCount: sources.length, presetName: preset.name, kinetic },
  });

  void renderReel(reelId, orgId, sources, preset, aspect, { kinetic, hook }).catch((err) => {
    log.error({ reelId, error: toErrorMessage(err) }, 'Background reel render rejected');
  });

  return row;
}

/** Background render: compose body (+ optional kinetic intro) -> upload -> ready. */
async function renderReel(
  reelId: string,
  orgId: string,
  sources: string[],
  preset: MotionPreset,
  aspect: ReelAspect,
  opts: { kinetic: boolean; hook: string },
): Promise<void> {
  const dims = REEL_DIMENSIONS[aspect];
  const fps = Math.max(12, Math.round(preset.fps));
  const bodyOut = path.join(os.tmpdir(), `flux-reel-body-${reelId}.mp4`);
  const introOut = path.join(os.tmpdir(), `flux-reel-intro-${reelId}.mp4`);
  const finalOut = path.join(os.tmpdir(), `flux-reel-final-${reelId}.mp4`);
  const temps = [bodyOut, introOut, finalOut];

  try {
    const slides = sources.map((source, index) => ({ index, source }));
    const body = await composeReel({ slides, preset, aspect, outPath: bodyOut });

    let outPath = bodyOut;
    let durationSec = body.durationSec;

    if (opts.kinetic && opts.hook) {
      // Animated-text hook card, then crossfade into the Ken Burns body.
      await captureKineticClip({
        html: kineticHookHtml({ hook: opts.hook, width: dims.width, height: dims.height }),
        width: dims.width,
        height: dims.height,
        fps,
        durationSec: KINETIC_INTRO_SEC,
        outPath: introOut,
      });
      await concatWithXfade({
        clipA: introOut,
        clipB: bodyOut,
        aDurationSec: KINETIC_INTRO_SEC,
        transitionSec: KINETIC_TRANSITION_SEC,
        width: dims.width,
        height: dims.height,
        fps,
        outPath: finalOut,
      });
      outPath = finalOut;
      durationSec =
        Math.round((KINETIC_INTRO_SEC + body.durationSec - KINETIC_TRANSITION_SEC) * 100) / 100;
    }

    const buf = fs.readFileSync(outPath);
    const storagePath = storagePaths.reel(orgId, reelId);
    const { publicUrl } = await uploadBuffer({
      bucket: env.SUPABASE_REEL_BUCKET,
      path: storagePath,
      body: buf,
      contentType: 'video/mp4',
    });

    await updateReel(orgId, reelId, {
      status: 'ready',
      storage_path: storagePath,
      public_url: publicUrl,
      bytes: buf.length,
      duration_sec: durationSec,
      fps,
    });
    log.info(
      { reelId, kinetic: opts.kinetic, bytes: buf.length, durationSec },
      'Reel ready',
    );
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
    for (const f of temps) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        /* best-effort temp cleanup */
      }
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
