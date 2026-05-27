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
import type { BrandProfile, CarouselContent, OrganizationRow, SlideContent, Template } from '../../types';

const log = childLogger({ module: 'carousel-content' });

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
}): Promise<CarouselContent & { hookArchetype: HookArchetype; layoutArchetypes: LayoutArchetype[] }> {
  // Pull the last N posts to drive anti-repetition + archetype rotation.
  // If anything fails (fresh workspace, transient DB issue) we proceed without
  // history — the brand voice block alone is still enough to generate.
  let diversityBlock = '';
  let hookArchetype: HookArchetype;
  let layoutArchetypes: LayoutArchetype[];
  try {
    const history = await getRecentHistory(input.organization.id, 12);
    hookArchetype = pickNextHookArchetype(history.recentHookArchetypes);
    layoutArchetypes = pickLayoutArchetypes(
      input.template.definition.slides.length,
      history.recentLayoutArchetypes,
    );
    diversityBlock = renderAntiRepetitionBlock(history, hookArchetype);
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
