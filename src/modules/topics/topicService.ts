/** Topic Engine — calendar lifecycle + AI topic generation. */
import { completeJson, type LlmCallContext } from '../../ai/llm';
import { buildTopicGenerationPrompt, topicGenerationSchema } from '../../ai/prompts';
import {
  getNextPendingTopic,
  getTopicById,
  insertTopics,
  updateTopic,
} from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import type {
  BrandProfile,
  ContentTopicRow,
  OrganizationRow,
} from '../../types';

const log = childLogger({ module: 'topics' });

export async function resolveTopic(
  orgId: string,
  topicId?: string,
  calendarId?: string,
): Promise<ContentTopicRow> {
  const row = topicId
    ? await getTopicById(orgId, topicId)
    : await getNextPendingTopic(orgId, calendarId);

  if (!row) {
    throw new NotFoundError(
      topicId
        ? `Topic ${topicId} not found in org ${orgId}`
        : 'No pending topics scheduled for today or earlier',
    );
  }
  log.info({ orgId, topicId: row.id, topic: row.topic }, 'Topic resolved');
  return row;
}

export async function markTopicProcessing(topic: ContentTopicRow): Promise<void> {
  await updateTopic(topic.organization_id, topic.id, {
    status: 'processing',
    attempts: topic.attempts + 1,
  });
}

export async function markTopicGenerated(
  topic: ContentTopicRow,
  approvalMode: 'auto' | 'manual',
): Promise<void> {
  await updateTopic(topic.organization_id, topic.id, {
    status: approvalMode === 'manual' ? 'generated' : 'approved',
  });
}

export async function markTopicPublished(topic: ContentTopicRow): Promise<void> {
  await updateTopic(topic.organization_id, topic.id, { status: 'published' });
}

export async function markTopicFailed(topic: ContentTopicRow): Promise<void> {
  await updateTopic(topic.organization_id, topic.id, { status: 'failed' });
  log.warn({ topicId: topic.id }, 'Topic marked failed — retry worker owns recovery');
}

/**
 * AI-generate a batch of topics for a brand and insert them into the
 * calendar. Used when calendar.topic_source = "ai" or "both".
 */
export async function generateAndInsertTopics(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  calendarId?: string;
  count: number;
  themeHint?: string;
}): Promise<ContentTopicRow[]> {
  const llmCtx = ctxFromOrg(input.organization);
  const { system, user } = buildTopicGenerationPrompt({
    brand: input.brand,
    count: input.count,
    themeHint: input.themeHint,
  });

  const out = await completeJson(
    { system, user, schema: topicGenerationSchema, temperature: 0.85 },
    llmCtx,
  );

  const today = new Date();
  const rows = out.topics.map((t, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      organization_id: input.organization.id,
      calendar_id: input.calendarId ?? null,
      topic: t.topic,
      angle: t.angle,
      post_type: t.post_type,
      scheduled_date: d.toISOString().slice(0, 10),
      priority: input.count - i,
      source: 'ai' as const,
      status: 'pending' as const,
    };
  });

  const inserted = await insertTopics(rows);
  log.info({ orgId: input.organization.id, count: inserted.length }, 'AI topics inserted');
  return inserted;
}

/** Pull the LLM context override (provider + key) from an organization row. */
export function ctxFromOrg(org: OrganizationRow): LlmCallContext {
  return {
    provider: org.ai_provider,
    apiKey: org.ai_provider_key,
  };
}
