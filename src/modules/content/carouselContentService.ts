/** Carousel content generation — calls the LLM with brand + template context. */
import { completeJson } from '../../ai/llm';
import { buildCarouselContentPrompt, carouselContentSchema } from '../../ai/prompts';
import { ctxFromOrg } from '../topics/topicService';
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
}): Promise<CarouselContent> {
  const { system, user } = buildCarouselContentPrompt({
    brand: input.brand,
    topic: input.topic,
    angle: input.angle,
    template: input.template.definition,
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
  };
}
