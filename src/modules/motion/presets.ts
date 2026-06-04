/**
 * Motion preset library — maps a style mode's motion DNA
 * (philosophy + intensity) onto a concrete ffmpeg recipe.
 *
 * The 40 style modes already carry `motion: { philosophy, intensity }`, so
 * reels inherit each brand style's personality for free: a "still" minimal
 * style gets a slow restrained drift; a "kinetic" gaming style gets fast
 * cuts and aggressive zooms.
 */
import type { MotionPhilosophy, MotionPreset } from './types';

export const MOTION_PHILOSOPHIES: MotionPhilosophy[] = [
  'still',
  'subtle',
  'dynamic',
  'cinematic',
  'kinetic',
];

/** Hand-tuned base recipe per motion philosophy (before intensity scaling). */
const BASE: Record<MotionPhilosophy, Omit<MotionPreset, 'key' | 'name' | 'description'>> = {
  still: {
    slideDurationSec: 3.2,
    transitionSec: 0.6,
    transition: 'fade',
    zoom: 'in',
    zoomIntensity: 0.12,
    grain: 0.05,
    vignette: 0.25,
    fps: 30,
  },
  subtle: {
    slideDurationSec: 2.8,
    transitionSec: 0.5,
    transition: 'dissolve',
    zoom: 'in-pan-right',
    zoomIntensity: 0.2,
    grain: 0.08,
    vignette: 0.3,
    fps: 30,
  },
  dynamic: {
    slideDurationSec: 2.4,
    transitionSec: 0.45,
    transition: 'smoothleft',
    zoom: 'in-pan-left',
    zoomIntensity: 0.32,
    grain: 0.1,
    vignette: 0.28,
    fps: 30,
  },
  cinematic: {
    slideDurationSec: 3.0,
    transitionSec: 0.7,
    transition: 'fadeblack',
    zoom: 'in',
    zoomIntensity: 0.28,
    grain: 0.16,
    vignette: 0.4,
    fps: 30,
  },
  kinetic: {
    slideDurationSec: 1.8,
    transitionSec: 0.3,
    transition: 'slideleft',
    zoom: 'in-pan-right',
    zoomIntensity: 0.45,
    grain: 0.12,
    vignette: 0.22,
    fps: 30,
  },
};

const META: Record<MotionPhilosophy, { name: string; description: string }> = {
  still: { name: 'Still Drift', description: 'Slow, restrained push-in. Editorial calm.' },
  subtle: { name: 'Subtle Glide', description: 'Gentle parallax dissolve. Premium, unhurried.' },
  dynamic: { name: 'Dynamic Sweep', description: 'Confident pans and quicker cuts.' },
  cinematic: {
    name: 'Cinematic',
    description: 'Deep grain, heavy vignette, film-black transitions.',
  },
  kinetic: { name: 'Kinetic', description: 'Fast cuts, aggressive zoom. Hype energy.' },
};

/**
 * Build a preset for a style mode's motion field. `intensity` (0..1) scales
 * the base recipe: higher = shorter holds, faster transitions, deeper zoom,
 * more grain.
 */
export function presetForStyleMotion(
  philosophy: MotionPhilosophy,
  intensity: number,
): MotionPreset {
  const base = BASE[philosophy] ?? BASE.subtle;
  const meta = META[philosophy] ?? META.subtle;
  const t = clamp01(intensity);

  return {
    key: `motion-${philosophy}`,
    name: meta.name,
    description: meta.description,
    slideDurationSec: round2(lerp(base.slideDurationSec, base.slideDurationSec * 0.7, t)),
    transitionSec: round2(lerp(base.transitionSec, base.transitionSec * 0.7, t)),
    transition: base.transition,
    zoom: base.zoom,
    zoomIntensity: round2(clamp01(base.zoomIntensity * (0.7 + t * 0.6))),
    grain: round2(clamp01(base.grain * (0.8 + t * 0.5))),
    vignette: base.vignette,
    fps: base.fps,
  };
}

/** Default preset when no style is supplied. */
export function defaultPreset(): MotionPreset {
  return presetForStyleMotion('cinematic', 0.5);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
