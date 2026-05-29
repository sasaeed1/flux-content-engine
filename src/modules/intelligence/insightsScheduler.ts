/**
 * Periodic insights refresher.
 *
 * Every N hours, iterate active orgs that have produced at least one
 * carousel and refresh their ai_insights cards. Free-tier-aware: skip orgs
 * with no recent activity (no point burning LLM quota on cold workspaces).
 */
import { supabase } from '../../lib/supabase';
import { childLogger } from '../../lib/logger';
import { generateInsightsForOrg } from './insightsGenerator';

const log = childLogger({ module: 'insights-scheduler' });

/**
 * Pull a short list of orgs that have done SOMETHING in the last 7 days,
 * have a brand profile, and don't have already-fresh insight cards.
 */
async function pickOrgsToRefresh(maxOrgs = 20): Promise<string[]> {
  // Active orgs = those with at least one carousel in the last 7 days.
  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const { data: recent, error } = await supabase
    .from('generated_carousels')
    .select('organization_id, created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    log.warn({ err: error.message }, 'recent-carousels query failed');
    return [];
  }
  const uniqueOrgs = Array.from(new Set((recent ?? []).map((r) => r.organization_id)));
  return uniqueOrgs.slice(0, maxOrgs);
}

export async function refreshAllInsights(): Promise<{ orgs: number; cards: number }> {
  const orgs = await pickOrgsToRefresh();
  let cards = 0;
  for (const orgId of orgs) {
    try {
      const n = await generateInsightsForOrg(orgId);
      cards += n;
    } catch (err) {
      log.warn({ orgId, err: (err as Error).message }, 'org refresh failed');
    }
  }
  return { orgs: orgs.length, cards };
}
