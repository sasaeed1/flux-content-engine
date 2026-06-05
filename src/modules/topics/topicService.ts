/** Topic Engine — calendar lifecycle + AI topic generation. */
import { completeJson, type LlmCallContext } from '../../ai/llm';
import { buildTopicGenerationPrompt, topicGenerationSchema } from '../../ai/prompts';
import {
  getNextPendingTopic,
  getTopicById,
  insertTopics,
  updateTopic,
} from '../../db/repositories';
import { ExternalApiError, NotFoundError, ValidationError } from '../../lib/errors';
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

/* ============================================================
 *  Website analysis → on-brand topics
 * ============================================================ */

// Block obvious SSRF targets (localhost / link-local / RFC1918).
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|::1|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 5000);
}

/**
 * Fetch a URL, extract its readable text, and AI-generate on-brand topics from
 * what the brand actually does/sells. Inserts them as pending topics.
 */
export async function generateTopicsFromWebsite(input: {
  organization: OrganizationRow;
  brand: BrandProfile;
  url: string;
  count: number;
  calendarId?: string;
}): Promise<ContentTopicRow[]> {
  let u: URL;
  try {
    u = new URL(input.url);
  } catch {
    throw new ValidationError('Invalid URL');
  }
  if (!/^https?:$/.test(u.protocol)) throw new ValidationError('URL must start with http(s)://');
  if (PRIVATE_HOST.test(u.hostname)) throw new ValidationError('That host is not allowed');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let html: string;
  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      headers: { 'user-agent': 'FluxBot/1.0 (+content-engine)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new ExternalApiError('website', `fetch returned ${res.status}`);
    html = await res.text();
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new ExternalApiError('website', 'fetch timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = extractText(html);
  if (text.length < 80) {
    throw new ValidationError('Could not extract enough readable content from that page');
  }

  const { system, user } = buildTopicGenerationPrompt({
    brand: input.brand,
    count: input.count,
    themeHint:
      "Derive topics from THIS brand's real website content below. Stay on-brand to what they " +
      `actually do/sell — turn their offerings, value props, and language into content ideas.\n"""\n${text}\n"""`,
  });
  const out = await completeJson(
    { system, user, schema: topicGenerationSchema, temperature: 0.8 },
    ctxFromOrg(input.organization),
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
      source: 'website' as const,
      status: 'pending' as const,
    };
  });
  const inserted = await insertTopics(rows);
  log.info(
    { orgId: input.organization.id, host: u.hostname, count: inserted.length },
    'Website topics inserted',
  );
  return inserted;
}

/** Pull the LLM context override (provider + key) from an organization row. */
export function ctxFromOrg(org: OrganizationRow): LlmCallContext {
  return {
    provider: org.ai_provider,
    apiKey: org.ai_provider_key,
  };
}
