/**
 * AI weekly summary — Sprint E.
 *
 * Once a week, for each active org, synthesize a plain-English briefing of the
 * week: what shipped, what resonated, and the single highest-leverage move for
 * next week. Stored as an ai_insights row (kind='weekly', surface='signals')
 * so the Signals surface can show it as a standing briefing card.
 *
 * Reuses the performance rollup (loadPerformanceWeights) so the briefing is
 * grounded in real engagement, not vibes.
 */
import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { getOrgById } from '../../db/repositories';
import { loadBrandProfile } from '../brand/brandService';
import { loadPerformanceWeights } from './performanceRollup';
import { completeJsonRouted } from '../../ai/router';
import { childLogger } from '../../lib/logger';

const log = childLogger({ module: 'weekly-summary' });

const summarySchema = z.object({
  headline: z.string().min(8).max(120),
  body: z.string().min(40).max(520),
  /** The one move that matters next week. */
  next_move: z.string().min(8).max(180),
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function rankTop(m: Map<string, { sample: number; avgEngagement: number }>, n = 3): string[] {
  return [...m.entries()]
    .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
    .slice(0, n)
    .map(([k, v]) => `${k.replace(/[-_]/g, ' ')} (${(v.avgEngagement * 100).toFixed(0)}%)`);
}

export async function generateWeeklySummaryForOrg(orgId: string): Promise<boolean> {
  const org = await getOrgById(orgId);
  if (!org) return false;

  const since = new Date(Date.now() - WEEK_MS).toISOString();

  const [brand, weights, publishedRes, shippedRes] = await Promise.all([
    loadBrandProfile(orgId, null).catch(() => null),
    loadPerformanceWeights(orgId).catch(() => null),
    supabase
      .from('published_posts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('published_at', since),
    supabase
      .from('generated_carousels')
      .select('title, hook, status, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const publishedThisWeek = publishedRes.count ?? 0;
  const shipped = shippedRes.data ?? [];
  const topHooks = weights ? rankTop(weights.byHook) : [];
  const topStyles = weights ? rankTop(weights.byStyle) : [];

  // Nothing to summarize — skip cold workspaces (no LLM burn).
  if (shipped.length === 0 && (weights?.sampleSize ?? 0) === 0) {
    log.info({ orgId }, 'No weekly activity — skipping summary');
    return false;
  }

  const system = [
    'You are the analyst writing a brand\'s weekly content briefing. Be specific, warm, and concise.',
    `Brand: niche=${brand?.niche || 'general'}, tone=${brand?.tone || 'direct'}.`,
    'Write a 2-3 sentence body summarizing the week and ONE concrete next move.',
    'Ground every claim in the data provided. No fabricated numbers.',
    'Return ONLY JSON: { "headline": "...", "body": "...", "next_move": "..." }',
  ].join('\n');

  const user = [
    `Carousels created this week: ${shipped.length}`,
    `Posts published this week: ${publishedThisWeek}`,
    shipped.length
      ? `Recent titles: ${shipped.slice(0, 5).map((s) => `"${s.title || s.hook || 'untitled'}"`).join(', ')}`
      : 'No new carousels this week.',
    topHooks.length ? `Top hook archetypes by engagement: ${topHooks.join(', ')}` : 'No hook performance signal yet.',
    topStyles.length ? `Top style modes by engagement: ${topStyles.join(', ')}` : '',
    `Total performance samples on file: ${weights?.sampleSize ?? 0}`,
  ]
    .filter(Boolean)
    .join('\n');

  let summary;
  try {
    summary = await completeJsonRouted(
      { system, user, schema: summarySchema, temperature: 0.5, maxTokens: 500 },
      { tier: 'balanced', cacheBypass: true },
    );
  } catch (err) {
    log.warn({ orgId, err: (err as Error).message }, 'weekly summary LLM failed');
    return false;
  }

  // Replace any prior weekly card for this org.
  await supabase
    .from('ai_insights')
    .delete()
    .eq('organization_id', orgId)
    .eq('kind', 'weekly');

  const { error } = await supabase.from('ai_insights').insert({
    organization_id: orgId,
    surface: 'signals',
    kind: 'weekly',
    headline: summary.headline,
    body: `${summary.body}\n\nNext move: ${summary.next_move}`,
    cta_label: 'Open the Forge',
    cta_href: '/forge',
    score: 0.97,
    expires_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    log.warn({ orgId, err: error.message }, 'weekly summary insert failed');
    return false;
  }
  log.info({ orgId, published: publishedThisWeek, created: shipped.length }, 'Weekly summary written');
  return true;
}

/** Generate weekly summaries for every org active in the last 14 days. */
export async function generateAllWeeklySummaries(): Promise<{ orgs: number; written: number }> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('generated_carousels')
    .select('organization_id')
    .gte('created_at', since)
    .limit(300);
  if (error) {
    log.warn({ err: error.message }, 'active-orgs query failed');
    return { orgs: 0, written: 0 };
  }
  const orgs = [...new Set((data ?? []).map((r) => r.organization_id as string))];
  let written = 0;
  for (const orgId of orgs) {
    try {
      if (await generateWeeklySummaryForOrg(orgId)) written += 1;
    } catch (err) {
      log.warn({ orgId, err: (err as Error).message }, 'weekly summary failed');
    }
  }
  return { orgs: orgs.length, written };
}
