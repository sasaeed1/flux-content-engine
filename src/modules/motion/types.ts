/**
 * Motion engine types — the shapes that drive zero-cost cinematic reel
 * rendering (PNG slides -> MP4 via ffmpeg). No external API, no GPU.
 *
 * A reel is composed from the slides the existing render composer already
 * produced. Each slide becomes a "clip" with a Ken Burns move; clips are
 * joined with cinematic transitions and finished with grain + vignette.
 */

/** Output canvas. Reels default to 9:16 (1080x1920) — the IG/TikTok native. */
export type ReelAspect = 'reel' | 'square' | 'portrait';

export interface ReelDimensions {
  width: number;
  height: number;
}

export const REEL_DIMENSIONS: Record<ReelAspect, ReelDimensions> = {
  reel: { width: 1080, height: 1920 }, // 9:16
  square: { width: 1080, height: 1080 }, // 1:1
  portrait: { width: 1080, height: 1350 }, // 4:5
};

/** Mirrors StyleMode.motion.philosophy so a style's DNA selects a preset. */
export type MotionPhilosophy = 'still' | 'subtle' | 'dynamic' | 'cinematic' | 'kinetic';

/** ffmpeg xfade transition names we expose (a cinematic-leaning subset). */
export type TransitionKind =
  | 'fade'
  | 'fadeblack'
  | 'dissolve'
  | 'slideleft'
  | 'slideup'
  | 'wipeleft'
  | 'smoothleft'
  | 'circleopen'
  | 'none';

/** Ken Burns camera move applied per slide via the zoompan filter. */
export type ZoomDirection = 'in' | 'out' | 'in-pan-right' | 'in-pan-left' | 'none';

/**
 * A motion preset — the deterministic recipe the composer turns into an
 * ffmpeg filtergraph. Intensities are 0..1 and scale concrete params.
 */
export interface MotionPreset {
  key: string;
  name: string;
  description: string;
  /** Seconds each slide holds on screen (before transition overlap). */
  slideDurationSec: number;
  /** Crossfade/transition duration between consecutive slides (seconds). */
  transitionSec: number;
  transition: TransitionKind;
  zoom: ZoomDirection;
  /** 0..1 — how aggressive the Ken Burns move is. */
  zoomIntensity: number;
  /** 0..1 — film grain strength (ffmpeg noise filter). */
  grain: number;
  /** 0..1 — vignette strength. */
  vignette: number;
  /** 0..1 — cinematic colour grade (contrast + saturation + teal/orange cast).
   *  Defaults to a subtle 0.5 in the composer when omitted. */
  grade?: number;
  /** 0..1 — filmic motion blur (frame blending over the Ken Burns move). 0 = off. */
  motionBlur?: number;
  /** Output frame rate. 30 is plenty for slide motion; keeps files small. */
  fps: number;
}

/** One slide to animate — a local file path or public URL, plus its order. */
export interface ReelSlideInput {
  index: number;
  /** Absolute local path OR https URL to the slide PNG. */
  source: string;
  /** Optional caption burned in over this slide (kinetic captions, phase 2). */
  caption?: string;
}

export interface ReelRenderInput {
  slides: ReelSlideInput[];
  preset: MotionPreset;
  aspect: ReelAspect;
  /** Optional output path. When omitted the composer writes to a temp file. */
  outPath?: string;
}

export interface ReelRenderResult {
  outPath: string;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  bytes: number;
  presetKey: string;
}
