/**
 * Prompt library + output schemas for the content-engine AI calls.
 *
 * All carousel/post copy follows the same retention philosophy:
 *   - Hook-first: slide 1 has to make scrolling feel like a mistake.
 *   - One idea per slide. Spoken cadence. Short sentences.
 *   - Pattern interrupts (numbers, contrarian beats, mini-stories).
 *   - Voice matches the org's brand profile (tone, niche, voice keywords).
 *   - Ends with ONE concrete CTA.
 *
 * Brand voice is wired in by passing the brand profile to every prompt.
 */
import { z } from 'zod';
import type { BrandProfile, SlideDefinition, TemplateDefinition } from '../types';

export interface Prompt {
  system: string;
  user: string;
}

/* ============================================================
 *  Brand voice block — shared by every content prompt
 * ============================================================ */

function brandVoiceBlock(brand: BrandProfile): string {
  const lines: string[] = [];
  lines.push(`BRAND VOICE:`);
  lines.push(`- niche: ${brand.niche ?? 'general business'}`);
  if (brand.businessType) lines.push(`- business: ${brand.businessType}`);
  if (brand.tone) lines.push(`- tone: ${brand.tone}`);
  if (brand.postStyle) lines.push(`- style: ${brand.postStyle}`);
  if (brand.ctaStyle) lines.push(`- CTA convention: ${brand.ctaStyle}`);
  if (brand.voiceKeywords.length > 0) {
    lines.push(`- voice keywords (use these): ${brand.voiceKeywords.join(', ')}`);
  }
  if (brand.voiceAvoid.length > 0) {
    lines.push(`- AVOID these traits: ${brand.voiceAvoid.join(', ')}`);
  }
  return lines.join('\n');
}

const COPY_RULES = [
  'COPY RULES — non-negotiable:',
  '1. HOOK FIRST. Slide 1 must STOP the scroll. Use ONE of:',
  '   - a specific, surprising number ("87% of small businesses still answer DMs by hand")',
  '   - a sharp contrarian claim ("Your funnel isn\'t broken. Your follow-up is.")',
  '   - a callout / pattern break ("Stop posting if you\'re doing this")',
  '   - an open loop ("There\'s a 12-second test that predicts every viral reel.")',
  '   - a "before/after" tease ("From 3 hours/day to 12 minutes — here\'s the swap.")',
  '   NEVER open with the topic title verbatim, generic phrases, or "let\'s talk about".',
  '2. ONE idea per slide. Short sentences. Spoken cadence, not written prose.',
  '3. Address the viewer directly as "you". Use contractions. No corporate tone.',
  '4. No emojis in slide copy (UNLESS the layout slot is explicitly emoji).',
  '5. Caption uses the same voice; emojis allowed sparingly (≤2 in the whole caption).',
  '6. Numbers > adjectives. Concrete > vague. Specific scenario > general advice.',
  '7. End with ONE clear CTA (follow / comment a keyword / save / DM).',
  '',
  'ANTI-FABRICATION — do NOT:',
  ' - invent precise statistics. Use defensible ranges ("roughly 2 in 3", "~70%",',
  '   "by some estimates") or skip the number entirely. Never write a fake "73%".',
  ' - invent attribution names ("John Doe", "Jane Smith", fictional CEOs, fake studies).',
  '   For quote attributions, prefer: the brand\'s own handle, "a founder we work with",',
  '   "one of our clients", or rephrase as a self-quote and drop the attribution.',
  ' - cite specific dollar amounts unless they are obviously hypothetical and framed as such.',
  ' - invent product names, company names, or case studies. If you need an example,',
  '   make it generic-but-vivid ("a 3-person agency doing $40k/mo") not name-dropping.',
  '',
  'CONCRETENESS — every slide should:',
  ' - reference a specific scenario, action, or moment the viewer recognises',
  ' - use vivid verbs (cuts, doubles, replaces, kills, unlocks) not weak ones (helps, supports)',
  ' - feel like one person talking to another, not a brand broadcasting',
].join('\n');

/* ============================================================
 *  1. TOPIC GENERATION
 *     Used when the calendar has topic_source = "ai" or "both".
 * ============================================================ */

export const topicGenerationSchema = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string(),
        angle: z.string(),
        post_type: z.enum([
          'single',
          'carousel',
          'quote',
          'cta',
          'announcement',
          'lead_magnet',
          'promotional',
          'educational',
        ]),
      }),
    )
    .min(1),
});

export function buildTopicGenerationPrompt(input: {
  brand: BrandProfile;
  count: number;
  themeHint?: string;
}): Prompt {
  const system = [
    'You are an expert short-form content strategist for Instagram. You generate',
    'high-retention topic ideas tailored to a specific brand and niche.',
    '',
    brandVoiceBlock(input.brand),
  ].join('\n');

  const user = [
    `Generate ${input.count} distinct content topics for this brand.`,
    input.themeHint ? `THEME HINT: ${input.themeHint}` : '',
    '',
    'Each topic should:',
    '- be specific and concrete (no generic "tips for success")',
    '- have a clear angle that makes it scroll-stopping',
    '- be appropriate for one of: single, carousel, quote, cta, announcement,',
    '  lead_magnet, promotional, educational',
    '',
    'Return ONLY a JSON object:',
    '{ "topics": [ { "topic": string, "angle": string, "post_type": string } ] }',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

/* ============================================================
 *  2. CAROUSEL CONTENT
 *     The big one. Generates slide content matching the template's slots.
 * ============================================================ */

const slideDataValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.number(),
]);

export const carouselContentSchema = z.object({
  title: z.string(),
  hook: z.string(),
  cta: z.string(),
  caption: z.string(),
  // Was .min(8) — too strict. Some providers occasionally return fewer when
  // the topic is narrow. Composer's hashtag normaliser tops up if needed.
  hashtags: z.array(z.string()).min(3),
  slides: z
    .array(
      z.object({
        role: z.enum(['hook', 'content', 'cta', 'quote']),
        layout: z.string(),
        data: z.record(z.string(), slideDataValueSchema),
      }),
    )
    .min(3),
});

function describeSlideSlots(slides: SlideDefinition[]): string {
  return slides
    .map(
      (s, i) =>
        `  Slide ${i + 1} — role: ${s.role}, layout: "${s.layout}", required slots: ${JSON.stringify(s.slots)}`,
    )
    .join('\n');
}

export function buildCarouselContentPrompt(input: {
  brand: BrandProfile;
  topic: string;
  angle?: string | null;
  template: TemplateDefinition;
  /** Optional anti-repetition + archetype guidance (from historyService). */
  diversityBlock?: string;
}): Prompt {
  const system = [
    'You are a world-class short-form content writer for Instagram carousels.',
    'Your carousels routinely pass 100k impressions. You write in the style of',
    'value-dense educational creators (Hormozi pacing, MrBeast retention).',
    '',
    brandVoiceBlock(input.brand),
    '',
    COPY_RULES,
    input.diversityBlock ? `\n${input.diversityBlock}` : '',
  ].join('\n');

  const slotSpec = describeSlideSlots(input.template.slides);
  const slideCount = input.template.slides.length;

  const user = [
    `TOPIC: ${input.topic}`,
    input.angle ? `ANGLE: ${input.angle}` : '',
    '',
    `Produce a ${slideCount}-slide carousel matching this template exactly.`,
    'Each slide has a fixed set of required slot keys you MUST fill in `data`.',
    'Use ONLY the listed slot keys for each slide — no extras, no omissions.',
    '',
    'TEMPLATE SLIDES:',
    slotSpec,
    '',
    'SLIDE RHYTHM — vary the texture across slides:',
    ' - Do NOT make every slide read the same. Alternate density.',
    ' - At least one slide should feel short (≤8 words). At least one should feel dense.',
    ' - At least one slide should anchor on a defensible number or short list — never two in a row.',
    ' - Hook → varied middle → close. The reader should feel pacing changes.',
    '',
    'SLOT VALUE GUIDANCE:',
    '- title: 4-8 words, punchy, often uppercase-feel. NOT the topic title verbatim.',
    '- subtitle: 6-14 words, supporting line — extends the title, never repeats it.',
    '- body: 1-3 short sentences (max ~24 words total). Specific scenario over generic claim.',
    '- number: a defensible figure — ranges ("~70%", "2 in 3") or qualified estimates.',
    '          NEVER invent precise statistics like "73%" or "$2.1B" out of thin air.',
    '          If no defensible number exists, ask the slide planner to swap the layout.',
    '- items: 3-5 items, each 2-6 words. Make them parallel in structure ("Lead gen,',
    '          Customer support, Reporting"). Not full sentences.',
    '- step: short label — "STEP 1", "STEP 2" (or "01" / "02"). Title carries the meaning.',
    '- attribution: prefer the brand handle (@<handle>), or a generic byline ("a founder',
    '          we work with"), or omit. NEVER invent a person\'s name.',
    '- cta: 3-7 word imperative tuned to the brand\'s ctaStyle. Pick ONE concrete action.',
    '- handle: the brand\'s @handle if known, else "@<brand-slug>". Never "@yourbrand" literal.',
    '',
    'Return ONLY a JSON object:',
    '{',
    '  "title": string,         // internal title',
    '  "hook": string,          // the slide-1 hook line, also reusable in caption',
    '  "cta": string,           // the slide-N call to action',
    '  "caption": string,       // IG caption: hook line + 2-4 value lines + CTA. Emojis allowed sparingly.',
    '  "hashtags": string[],    // 12-22 tags WITHOUT the # symbol, mix big/medium/niche',
    '  "slides": [',
    '    { "role": "hook"|"content"|"cta"|"quote", "layout": string, "data": { ...slot-keyed copy } }',
    '  ]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

/* ============================================================
 *  3. SINGLE POST CONTENT
 * ============================================================ */

export const singlePostContentSchema = z.object({
  title: z.string(),
  body: z.string(),
  cta: z.string(),
  caption: z.string(),
  // Was .min(8) — too strict. Some providers occasionally return fewer when
  // the topic is narrow. Composer's hashtag normaliser tops up if needed.
  hashtags: z.array(z.string()).min(3),
  data: z.record(z.string(), slideDataValueSchema),
});

export function buildSinglePostContentPrompt(input: {
  brand: BrandProfile;
  topic: string;
  angle?: string | null;
  template: TemplateDefinition;
}): Prompt {
  const slide = input.template.slides[0];

  const system = [
    'You are a world-class Instagram single-post writer. Your posts get saved + shared.',
    '',
    brandVoiceBlock(input.brand),
    '',
    COPY_RULES,
  ].join('\n');

  const user = [
    `TOPIC: ${input.topic}`,
    input.angle ? `ANGLE: ${input.angle}` : '',
    '',
    `LAYOUT: ${slide?.layout ?? 'title-cta'}`,
    `REQUIRED SLOTS: ${JSON.stringify(slide?.slots ?? ['title', 'body', 'cta'])}`,
    '',
    'Return ONLY a JSON object:',
    '{',
    '  "title": string,',
    '  "body": string,',
    '  "cta": string,',
    '  "caption": string,',
    '  "hashtags": string[],',
    '  "data": { /* fill the layout slot keys */ }',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

/* ============================================================
 *  4. CAPTION (standalone — regenerate caption for an existing post)
 * ============================================================ */

export const captionSchema = z.object({
  caption: z.string(),
  // Was .min(8) — too strict. Some providers occasionally return fewer when
  // the topic is narrow. Composer's hashtag normaliser tops up if needed.
  hashtags: z.array(z.string()).min(3),
});

export function buildCaptionPrompt(input: {
  brand: BrandProfile;
  topic: string;
  hook?: string;
}): Prompt {
  const system = [
    'You write high-performing Instagram captions. First line stops the scroll;',
    'middle lines deliver value; last line drives one specific action.',
    '',
    brandVoiceBlock(input.brand),
  ].join('\n');

  const user = [
    `TOPIC: ${input.topic}`,
    input.hook ? `HOOK LINE (reuse or echo): ${input.hook}` : '',
    '',
    'Return ONLY:',
    '{ "caption": string, "hashtags": string[] }',
    '12-22 hashtags WITHOUT the # symbol, mixing big/medium/niche.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

/* ============================================================
 *  5. HASHTAGS (standalone)
 * ============================================================ */

export const hashtagsSchema = z.object({
  // Was .min(8) — too strict. Some providers occasionally return fewer when
  // the topic is narrow. Composer's hashtag normaliser tops up if needed.
  hashtags: z.array(z.string()).min(3),
});

export function buildHashtagsPrompt(input: {
  brand: BrandProfile;
  topic: string;
  count?: number;
}): Prompt {
  const system = `You are an Instagram hashtag specialist for the ${input.brand.niche ?? 'business'} niche.`;
  const user = [
    `TOPIC: ${input.topic}`,
    `Generate ${input.count ?? 20} hashtags. Mix:`,
    '- big tags (>1M posts) — discoverability',
    '- medium tags (50k–1M) — best for ranking',
    '- niche tags (<50k) — high intent',
    '',
    'Return ONLY: { "hashtags": string[] } — WITHOUT the # symbol.',
  ].join('\n');
  return { system, user };
}

/* ============================================================
 *  6. HOOK VARIANTS  (future A/B testing)
 * ============================================================ */

export const hookVariantsSchema = z.object({
  hooks: z
    .array(z.object({ text: z.string(), style: z.string() }))
    .min(5),
});

export function buildHookVariantsPrompt(input: {
  brand: BrandProfile;
  topic: string;
}): Prompt {
  const system = [
    'You are a viral hook specialist for Instagram. Generate scroll-stopping',
    'opening lines, each in a distinct psychological style.',
    '',
    brandVoiceBlock(input.brand),
  ].join('\n');

  const user = [
    `TOPIC: ${input.topic}`,
    '',
    'Produce 8-12 hooks. Styles to cover where they fit:',
    'curiosity-gap, bold-claim, contrarian, stat-shock, callout, story-tease,',
    'negativity-bias, fomo, question, before-after.',
    '',
    'Return ONLY: { "hooks": [ { "text": string, "style": string } ] }',
  ].join('\n');

  return { system, user };
}
