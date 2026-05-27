/**
 * Post-generation editing — caption rewrites, CTA variants, slide rewrites.
 *
 * Users do NOT want fully autonomous AI. They want AI that gets them 90% of
 * the way there and lets them touch up the rest. This service is the touch-up
 * layer — each call is a small, fast LLM round-trip targeting a single field.
 *
 * All calls are scoped by org via the existing AIContext.
 */
import { z } from 'zod';
import { completeJson } from '../../ai/llm';
import { ctxFromOrg } from '../topics/topicService';
import { getCarouselByIdScoped, updateCarousel } from '../../db/repositories';
import { ValidationError, AppError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import type { BrandProfile, OrganizationRow, SlideContent } from '../../types';

const log = childLogger({ module: 'content-edit' });

/* ------------------------------------------------------------------ */
/* Caption rewrites                                                   */
/* ------------------------------------------------------------------ */

export type CaptionStyle =
  | 'shorter'
  | 'longer'
  | 'professional'
  | 'casual'
  | 'aggressive'
  | 'stronger-cta'
  | 'rewrite';

const STYLE_PROMPT: Record<CaptionStyle, string> = {
  shorter:
    'Cut this caption to roughly 60% of its length. Preserve the hook and the CTA. Drop adjectives and connector phrases first.',
  longer:
    'Expand this caption by 30-50%. Add ONE concrete value line and ONE additional reason the viewer should care. Keep the same voice and CTA.',
  professional:
    'Rewrite this caption in a more polished, B2B-friendly tone. Crisp, confident, no slang. Same content, same CTA, slightly more formal cadence.',
  casual:
    'Rewrite this caption in a more conversational, founder-to-friend tone. Use contractions, drop corporate phrases, address the viewer directly. Same CTA.',
  aggressive:
    'Rewrite this caption with more punch. Stronger verbs, shorter sentences, an unmissable CTA. Keep it grounded — no hype words like "game-changing".',
  'stronger-cta':
    'Keep the body of this caption the same. Replace the closing CTA with a sharper, more specific imperative (one concrete action).',
  rewrite:
    'Rewrite this caption from scratch keeping the same topic, hook spirit, and CTA intent. Different sentences, different cadence — same value.',
};

const captionResultSchema = z.object({
  caption: z.string().min(20).max(2200),
});

function brandHint(brand: BrandProfile): string {
  const bits: string[] = [];
  if (brand.tone) bits.push(`Tone: ${brand.tone}`);
  if (brand.voiceKeywords.length) bits.push(`Use words like: ${brand.voiceKeywords.slice(0, 6).join(', ')}`);
  if (brand.voiceAvoid.length) bits.push(`Avoid: ${brand.voiceAvoid.slice(0, 6).join(', ')}`);
  return bits.join(' · ');
}

export async function rewriteCaption(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  current: string;
  style: CaptionStyle;
}): Promise<string> {
  const system = [
    'You rewrite Instagram captions. You are precise and concise.',
    'You always return a single JSON object: { "caption": "<the new caption>" }.',
    'You never include hashtags in the caption — those live elsewhere.',
    `BRAND: ${brandHint(input.brand)}`,
  ].join('\n');

  const user = [
    `CURRENT CAPTION:\n"""${input.current}"""`,
    '',
    `INSTRUCTION: ${STYLE_PROMPT[input.style]}`,
    '',
    'Return only JSON. Do not include the word "caption" anywhere except as the JSON key.',
  ].join('\n');

  const result = await completeJson(
    { system, user, schema: captionResultSchema, temperature: 0.7 },
    ctxFromOrg(input.organization),
  );
  return result.caption.trim();
}

/* ------------------------------------------------------------------ */
/* CTA variations                                                     */
/* ------------------------------------------------------------------ */

const ctaResultSchema = z.object({
  ctas: z.array(z.string().min(3).max(80)).min(1).max(6),
});

export async function rewriteCta(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  current: string;
  variations: number;
}): Promise<string[]> {
  const n = Math.max(1, Math.min(6, input.variations));
  const system = [
    'You write Instagram CTAs. Each CTA is a single short imperative — 3-8 words.',
    'Different verbs, different specificity, different mechanisms (DM, comment, save, follow, link).',
    `BRAND: ${brandHint(input.brand)}`,
    'Return JSON: { "ctas": ["...", "..."] }. No numbering, no quotes inside the strings.',
  ].join('\n');

  const user = [
    `CURRENT CTA: "${input.current}"`,
    `Produce ${n} distinct alternatives. Vary the mechanism and the verb across them.`,
  ].join('\n');

  const result = await completeJson(
    { system, user, schema: ctaResultSchema, temperature: 0.85 },
    ctxFromOrg(input.organization),
  );
  return result.ctas.map((c) => c.trim());
}

/* ------------------------------------------------------------------ */
/* Single-slide rewrites + regeneration                               */
/* ------------------------------------------------------------------ */

export type SlideEditStyle =
  | 'rewrite'
  | 'shorter'
  | 'denser'
  | 'rewrite-hook'
  | 'rewrite-cta';

const slideEditPrompt: Record<SlideEditStyle, string> = {
  rewrite: 'Rewrite this slide\'s copy with different phrasing — same meaning, different words.',
  shorter:
    'Tighten this slide. Cut to the shortest version that still lands. Drop adjectives and connector words.',
  denser:
    'Make this slide carry more information. Add a specific detail, scenario, or number. Stay within the same slot lengths.',
  'rewrite-hook':
    'Rewrite the hook on this slide. Use a different rhetorical move (curiosity, contrarian, stat, scene) than the current one.',
  'rewrite-cta':
    'Rewrite the call-to-action on this slide. Different verb, different mechanism.',
};

const slideResultSchema = z.object({
  data: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.number()])),
});

export async function rewriteSlide(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  slide: SlideContent;
  style: SlideEditStyle;
}): Promise<SlideContent> {
  const system = [
    'You rewrite individual carousel slides. You return ONLY the new `data` object',
    'for that slide — same slot keys as the input, same value types. No new keys.',
    `BRAND: ${brandHint(input.brand)}`,
    'Return JSON: { "data": { ...sameKeys } }.',
  ].join('\n');

  const user = [
    `SLIDE LAYOUT: ${input.slide.layout}`,
    `SLIDE ROLE: ${input.slide.role}`,
    `CURRENT DATA:`,
    JSON.stringify(input.slide.data, null, 2),
    '',
    `INSTRUCTION: ${slideEditPrompt[input.style]}`,
    '',
    'Use the EXACT SAME slot keys. Do not add new keys. Do not drop keys.',
  ].join('\n');

  const result = await completeJson(
    { system, user, schema: slideResultSchema, temperature: 0.8 },
    ctxFromOrg(input.organization),
  );

  return {
    ...input.slide,
    data: result.data as SlideContent['data'],
  };
}

/* ------------------------------------------------------------------ */
/* Persistence helpers (load, mutate, save)                           */
/* ------------------------------------------------------------------ */

export async function applyCaptionEdit(
  orgId: string,
  carouselId: string,
  caption: string,
): Promise<void> {
  const trimmed = caption.trim();
  if (trimmed.length < 5) throw new ValidationError('Caption is too short');
  if (trimmed.length > 2200) throw new ValidationError('Caption exceeds Instagram\'s 2200 char limit');
  await updateCarousel(orgId, carouselId, { caption: trimmed });
}

export async function applyCtaEdit(
  orgId: string,
  carouselId: string,
  cta: string,
): Promise<void> {
  const trimmed = cta.trim();
  if (trimmed.length < 2) throw new ValidationError('CTA is too short');
  if (trimmed.length > 200) throw new ValidationError('CTA is too long');
  await updateCarousel(orgId, carouselId, { cta: trimmed });
}

export async function applySlideEdit(
  orgId: string,
  carouselId: string,
  slideIndex: number,
  newSlide: SlideContent,
): Promise<SlideContent[]> {
  const carousel = await getCarouselByIdScoped(orgId, carouselId);
  if (!carousel) throw new AppError('Carousel not found', { status: 404, code: 'NOT_FOUND' });
  const slides = (carousel.slides ?? []) as SlideContent[];
  if (!Array.isArray(slides) || slideIndex < 0 || slideIndex >= slides.length) {
    throw new ValidationError(`Slide index ${slideIndex} out of range`);
  }
  const next = slides.slice();
  next[slideIndex] = { ...next[slideIndex], ...newSlide, index: slideIndex };
  await updateCarousel(orgId, carouselId, {
    slides: next as unknown as Record<string, unknown>,
  });
  log.info({ carouselId, slideIndex }, 'Slide edited');
  return next;
}
