/** System-wide constants. */

/** Instagram media dimensions. Default to 4:5 portrait for max feed real estate. */
export const IG = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 }, // 4:5 — recommended for feed + carousels
  story: { width: 1080, height: 1920 },
} as const;

export const DEFAULT_SLIDE_DIMS = IG.portrait;

/** Pipeline steps for a carousel run. */
export const PIPELINE_STEPS = [
  'topic',
  'content',     // LLM: title, hook, slides, caption, hashtags, CTA
  'images',      // optional: AI image generation per slide
  'render',      // HTML/CSS -> PNG per slide
  'upload',      // PNGs uploaded to public bucket
  'enqueue',     // insert into publish_queue
] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** Pipeline steps for a single post (simpler subset). */
export const SINGLE_POST_STEPS = ['topic', 'content', 'images', 'render', 'upload', 'enqueue'] as const;

/** Default retry profile for outbound API calls. */
export const DEFAULT_RETRY = {
  retries: 4,
  baseDelayMs: 1500,
  maxDelayMs: 45_000,
} as const;

/** Instagram per-carousel image limit. */
export const IG_CAROUSEL_MAX_ITEMS = 10;

/** Output PNG quality (sharp). */
export const PNG_QUALITY = 88;
