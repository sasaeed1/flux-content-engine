/**
 * Insights generator — produces the AI presence cards shown on Dashboard
 * + Studio. Combines brand profile + recent runs + content performance into
 * 1-3 specific, actionable recommendations.
 *
 * Stored in `ai_insights` so the UI reads cached cards instantly. The
 * scheduler runs this every few hours per org. Users can also manually
 * trigger via POST /api/tenant/intelligence/insights/refresh.
 */
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { getOrgById, getDefaultBrandForOrg } from '../../db/repositories';
import { loadBrandProfile } from '../brand/brandService';
import { completeJsonRouted } from '../../ai/router';
import { childLogger } from '../../lib/logger';

const log = childLogger({ module: 'insights' });

const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        surface: z.enum(['dashboard', 'library', 'studio']),
        kind: z.enum(['trend', 'optimization', 'next-action']),
        headline: z.string().min(8).max(140),
        body: z.string().min(20).max(380),
        cta_label: z.string().min(2).max(40).nullable().optional(),
        cta_href: z.string().min(1).max(200).nullable().optional(),
        score: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(8),
});

/**
 * Refresh insight cards for one org. Deletes the org's expired/old cards
 * first, then runs a single LLM call to generate fresh ones, then writes
 * them with a 24h expiry.
 */
export async function generateInsightsForOrg(orgId: string): Promise<number> {
  const org = await getOrgById(orgId);
  if (!org) return 0;
  const brand = await loadBrandProfile(orgId, null);

  // Pull recent context for the prompt — last 8 runs, last 8 carousels,
  // and any performance data on file.
  const [{ data: runs }, { data: carousels }, { data: perf }] = await Promise.all([
    supabase
      .from('pipeline_runs')
      .select('status, current_step, type, started_at')
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('generated_carousels')
      .select('hook, status, created_at, metadata')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('content_performance')
      .select('hook_archetype, style_mode_key, engagement_rate')
      .eq('organization_id', orgId)
      .order('engagement_rate', { ascending: false })
      .limit(20),
  ]);

  const recentHooks = (carousels ?? [])
    .map((c) => c.hook)
    .filter((h): h is string => !!h && h.length > 5)
    .slice(0, 6);

  const successRate =
    (runs ?? []).filter((r) => r.status === 'completed').length /
    Math.max(1, runs?.length ?? 0);

  // Compose a single prompt that asks for 3-5 tailored cards.
  const system = [
    'You are the Flux content strategist. You write insight cards for the',
    "user's dashboard — concrete, brand-aware, action-oriented.",
    '',
    `BRAND: name=${brand.name}, niche=${brand.niche ?? 'general business'}, tone=${brand.tone ?? 'direct'}.`,
    '',
    'CARD KINDS:',
    ' - "trend"        — surface a content pattern or opportunity worth riding.',
    ' - "optimization" — point at something they are doing that could be sharper.',
    ' - "next-action"  — propose one specific next move (with a CTA link).',
    '',
    'CTA hrefs must be one of: /studio, /library, /brand, /themes, /settings.',
    'Cards must be specific to THIS brand — never generic platitudes.',
    'Tone: confident, warm, peer-to-peer. Never preachy. No emoji.',
    '',
    'Return: { "insights": [{ "surface": "dashboard"|"library"|"studio", "kind": "...", "headline": "...", "body": "...", "cta_label": "...", "cta_href": "...", "score": 0.0-1.0 }] }',
  ].join('\n');

  const user = [
    `ORG STATS:`,
    `  recent_pipeline_runs: ${runs?.length ?? 0}, success_rate: ${(successRate * 100).toFixed(0)}%`,
    `  recent_carousels: ${carousels?.length ?? 0}`,
    `  performance_samples: ${perf?.length ?? 0}`,
    '',
    recentHooks.length
      ? `RECENT HOOKS:\n${recentHooks.map((h) => `  - "${h}"`).join('\n')}`
      : 'RECENT HOOKS: none yet — this is a fresh workspace.',
    '',
    'Produce 3 insight cards: at least 1 trend, 1 optimization, 1 next-action.',
    'Surface mix: 1-2 on "dashboard", 1 on "studio". Skip "library" unless very relevant.',
  ].join('\n');

  let result: z.infer<typeof insightSchema>;
  try {
    result = await completeJsonRouted(
      { system, user, schema: insightSchema, temperature: 0.7, maxTokens: 1500 },
      { tier: 'balanced', cacheEnabled: false },
    );
  } catch (err) {
    log.warn({ orgId, err: (err as Error).message }, 'insights generation failed');
    return 0;
  }

  // Wipe stale insights for this org (not the user-dismissed ones, but the
  // unread, undismissed expired ones).
  await supabase
    .from('ai_insights')
    .delete()
    .eq('organization_id', orgId)
    .is('dismissed_at', null);

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const rows = result.insights.map((card) => ({
    organization_id: orgId,
    surface: card.surface,
    kind: card.kind,
    headline: card.headline,
    body: card.body,
    cta_label: card.cta_label ?? null,
    cta_href: card.cta_href ?? null,
    score: card.score,
    expires_at: expiresAt,
  }));

  const { error } = await supabase.from('ai_insights').insert(rows);
  if (error) {
    log.warn({ orgId, err: error.message }, 'insights insert failed');
    return 0;
  }
  log.info({ orgId, count: rows.length }, 'insights refreshed');
  return rows.length;
}
