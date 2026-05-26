/** Single-post content generation. */
import { completeJson } from '../../ai/llm';
import { buildSinglePostContentPrompt, singlePostContentSchema } from '../../ai/prompts';
import { ctxFromOrg } from '../topics/topicService';
import { childLogger } from '../../lib/logger';
import type {
  BrandProfile,
  OrganizationRow,
  SinglePostContent,
  Template,
} from '../../types';

const log = childLogger({ module: 'single-post-content' });

function normaliseHashtags(tags: string[]): string[] {
  return tags
    .map((t) => t.replace(/^#+/, '').replace(/[^a-zA-Z0-9_]/g, '').trim())
    .filter((t) => t.length > 1)
    .slice(0, 30);
}

export async function generateSinglePostContent(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  template: Template;
  topic: string;
  angle?: string | null;
}): Promise<SinglePostContent> {
  const { system, user } = buildSinglePostContentPrompt({
    brand: input.brand,
    topic: input.topic,
    angle: input.angle,
    template: input.template.definition,
  });

  const raw = await completeJson(
    { system, user, schema: singlePostContentSchema, temperature: 0.85 },
    ctxFromOrg(input.organization),
  );

  const hashtags = normaliseHashtags(raw.hashtags);
  const slide = input.template.definition.slides[0];

  log.info({ orgId: input.organization.id, layout: slide?.layout }, 'Single post content generated');

  return {
    title: raw.title,
    body: raw.body,
    cta: raw.cta,
    caption: raw.caption,
    hashtags,
    layout: slide?.layout ?? 'title-cta',
    data: raw.data,
  };
}
