/** Standalone caption + hashtags regeneration. */
import { completeJson } from '../../ai/llm';
import { buildCaptionPrompt, captionSchema } from '../../ai/prompts';
import { ctxFromOrg } from '../topics/topicService';
import type { BrandProfile, OrganizationRow } from '../../types';

export async function regenerateCaption(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  topic: string;
  hook?: string;
}): Promise<{ caption: string; hashtags: string[] }> {
  const { system, user } = buildCaptionPrompt({
    brand: input.brand,
    topic: input.topic,
    hook: input.hook,
  });
  const raw = await completeJson(
    { system, user, schema: captionSchema, temperature: 0.8 },
    ctxFromOrg(input.organization),
  );
  return {
    caption: raw.caption,
    hashtags: raw.hashtags.map((t) => t.replace(/^#+/, '').trim()).filter(Boolean),
  };
}
