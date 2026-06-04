/** Carousel content generation — calls the LLM with brand + template context. */
import { completeJson } from '../../ai/llm';
import { buildCarouselContentPrompt, carouselContentSchema } from '../../ai/prompts';
import { ctxFromOrg } from '../topics/topicService';
import {
  getRecentHistory,
  pickNextHookArchetype,
  pickLayoutArchetypes,
  renderAntiRepetitionBlock,
  type HookArchetype,
  type LayoutArchetype,
} from './historyService';
import { childLogger } from '../../lib/logger';
import { loadPerformanceWeights } from '../intelligence/performanceRollup';
import { renderPerformanceMemoryBlock } from '../intelligence/memoryPromptBlock';
import type {
  BrandProfile,
  CarouselContent,
  OrganizationRow,
  SlideContent,
  SlideDefinition,
  Template,
} from '../../types';

const log = childLogger({ module: 'carousel-content' });

const MIN_SLIDES = 3;
const MAX_SLIDES = 10;

/**
 * Dynamically resize a template's slide sequence to a target count (slide-count
 * control). Keeps the hook (first) + CTA (last); repeats/trims the middle
 * content layouts to hit the target. Returns the base unchanged when no target
 * is given or the template is too short to adjust safely.
 */
function adjustSlideCount(base: SlideDefinition[], target?: number): SlideDefinition[] {
  if (!target || base.length < 3) return base;
  const t = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(target)));
  if (t === base.length) return base;
  const hook = base[0];
  const cta = base[base.length - 1];
  const middle = base.slice(1, -1);
  if (middle.length === 0) return base;
  const out: SlideDefinition[] = [hook];
  for (let i = 0; i < t - 2; i++) out.push(middle[i % middle.length]);
  out.push(cta);
  return out;
}

/**
 * Richer layout catalog for the middle (content) slides. Rotating through it
 * injects the advanced layouts (timeline/comparison/infographic/editorial)
 * alongside the classics so carousels aren't visually monotonous. Hook + CTA
 * slides are left untouched.
 */
const CONTENT_LAYOUTS: ReadonlyArray<{ layout: string; slots: string[] }> = [
  { layout: 'stat-callout', slots: ['number', 'title', 'body'] },
  { layout: 'two-column-list', slots: ['title', 'items'] },
  { layout: 'step', slots: ['step', 'title', 'body'] },
  { layout: 'timeline', slots: ['title', 'items'] },
  { layout: 'comparison', slots: ['title', 'leftTitle', 'leftItems', 'rightTitle', 'rightItems'] },
  { layout: 'infographic', slots: ['title', 'items'] },
  { layout: 'editorial', slots: ['kicker', 'title', 'body'] },
  { layout: 'single-quote', slots: ['body', 'attribution'] },
];

function diversifyLayouts(slides: SlideDefinition[]): SlideDefinition[] {
  let i = Math.floor(Math.random() * CONTENT_LAYOUTS.length);
  return slides.map((sl) => {
    if (sl.role !== 'content') return sl;
    const pick = CONTENT_LAYOUTS[i % CONTENT_LAYOUTS.length];
    i += 1;
    return { ...sl, layout: pick.layout, slots: [...pick.slots] };
  });
}

function normaliseHashtags(tags: string[]): string[] {
  return tags
    .map((t) => t.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').trim())
    .filter((t) => t.length > 1)
    .slice(0, 30);
}

export async function generateCarouselContent(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  template: Template;
  topic: string;
  angle?: string | null;
  /** Optional user-requested slide count (3–10) — overrides the template. */
  slideCount?: number;
}): Promise<CarouselContent & { hookArchetype: HookArchetype; layoutArchetypes: LayoutArchetype[] }> {
  const effectiveSlides = diversifyLayouts(
    adjustSlideCount(input.template.definition.slides, input.slideCount),
  );
  // Pull the last N posts to drive anti-repetition + archetype rotation.
  // If anything fails (fresh workspace, transient DB issue) we proceed without
  // history — the brand voice block alone is still enough to generate.
  let diversityBlock = '';
  let hookArchetype: HookArchetype;
  let layoutArchetypes: LayoutArchetype[];
  try {
    // Phase 3D — pull engagement weights so the hook picker biases toward
    // archetypes that actually performed for THIS brand. Falls back to pure
    // anti-repetition rotation when there's no signal yet.
    const [history, weights] = await Promise.all([
      getRecentHistory(input.organization.id, 12),
      loadPerformanceWeights(input.organization.id).catch(() => undefined),
    ]);
    hookArchetype = pickNextHookArchetype(
      history.recentHookArchetypes,
      weights?.byHook,
    );
    layoutArchetypes = pickLayoutArchetypes(
      effectiveSlides.length,
      history.recentLayoutArchetypes,
    );
    diversityBlock = renderAntiRepetitionBlock(history, hookArchetype);

    // Post-audit #2 — also feed the weighted memory INTO the LLM prompt,
    // not just into the picker. The model learns "Q1: deep-dives are
    // working; comparisons aren't" instead of generic taste.
    if (weights && weights.sampleSize > 0) {
      const memoryBlock = await renderPerformanceMemoryBlock(input.organization.id, {
        preloaded: weights,
        topPerDim: 3,
      }).catch(() => '');
      if (memoryBlock) {
        diversityBlock = `${diversityBlock}\n\n${memoryBlock}`;
      }
    }

    if (weights && weights.byHook.size > 0) {
      log.info(
        {
          orgId: input.organization.id,
          archetypeChosen: hookArchetype,
          weighted: true,
          weightedCandidates: weights.byHook.size,
          sampleSize: weights.sampleSize,
        },
        'Hook archetype picked with engagement weighting + memory in prompt',
      );
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'history fetch failed — generating without diversity guidance');
    hookArchetype = 'curiosity';
    layoutArchetypes = [];
  }

  const { system, user } = buildCarouselContentPrompt({
    brand: input.brand,
    topic: input.topic,
    angle: input.angle,
    template: input.template.definition,
    slides: effectiveSlides,
    diversityBlock,
  });

  const raw = await completeJson(
    { system, user, schema: carouselContentSchema, temperature: 0.85 },
    ctxFromOrg(input.organization),
  );

  const slides: SlideContent[] = raw.slides.map((s, i) => ({
    index: i,
    role: s.role,
    layout: s.layout,
    data: s.data,
  }));

  const hashtags = normaliseHashtags(raw.hashtags);

  log.info(
    {
      orgId: input.organization.id,
      slides: slides.length,
      hashtags: hashtags.length,
      hookArchetype,
      layoutArchetypes,
    },
    'Carousel content generated',
  );

  return {
    title: raw.title,
    hook: raw.hook,
    cta: raw.cta,
    caption: raw.caption,
    hashtags,
    slides,
    hookArchetype,
    layoutArchetypes,
  };
}
