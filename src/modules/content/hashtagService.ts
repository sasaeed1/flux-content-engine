/** Standalone hashtag generation. */
import { completeJson } from '../../ai/llm';
import { buildHashtagsPrompt, hashtagsSchema } from '../../ai/prompts';
import { ctxFromOrg } from '../topics/topicService';
import type { BrandProfile, OrganizationRow } from '../../types';

export async function generateHashtags(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  topic: string;
  count?: number;
}): Promise<string[]> {
  const { system, user } = buildHashtagsPrompt({
    brand: input.brand,
    topic: input.topic,
    count: input.count,
  });
  const raw = await completeJson(
    { system, user, schema: hashtagsSchema, temperature: 0.7 },
    ctxFromOrg(input.organization),
  );
  return raw.hashtags.map((t) => t.replace(/^#+/, '').trim()).filter(Boolean);
}
