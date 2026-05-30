/**
 * Content history + anti-repetition + hook archetype rotation.
 *
 * The biggest long-term risk for AI-generated content is everything looking
 * the same. This service pulls the last N carousels for an org and exposes:
 *
 *   - recent hooks  → injected into prompts as "avoid these patterns"
 *   - recent CTAs   → ditto
 *   - recent layouts → so the renderer can rotate visual rhythm
 *   - recent hook archetypes → so the next generation is forced into a
 *     different archetype
 *
 * No schema migration needed — archetype data lives on
 * `generated_carousels.metadata.hook_archetype` and `.layout_archetypes`.
 */
import { supabase } from '../../lib/supabase';
import { DatabaseError } from '../../lib/errors';

/**
 * Fourteen hook archetypes — the viral diversity engine rotates between
 * these. The first 8 are the original retention-focused set; the new 6
 * (scarcity / controversy / future-prediction / anti-guru / data /
 * comparison) cover scroll-stopping styles that work best for SMB content.
 */
export const HOOK_ARCHETYPES = [
  'curiosity',
  'fear',
  'authority',
  'storytelling',
  'myth-busting',
  'contrarian',
  'educational',
  'list-style',
  'scarcity',
  'controversy',
  'future-prediction',
  'anti-guru',
  'data-driven',
  'comparison',
] as const;

export type HookArchetype = (typeof HOOK_ARCHETYPES)[number];

/** Layout archetypes for visual rhythm — the composer rotates these. */
export const LAYOUT_ARCHETYPES = [
  'minimalist', // a few words on a clean background
  'oversized',  // gigantic typography, single statement
  'quote',      // pull-quote treatment with attribution
  'image-heavy',// background image takes 60%+ of slide
  'stat',       // a big number + one supporting line
  'dense',      // 3-5 list items, tight type
  'transition', // single word / phrase / breath-slide
] as const;

export type LayoutArchetype = (typeof LAYOUT_ARCHETYPES)[number];

const ARCHETYPE_GUIDANCE: Record<HookArchetype, string> = {
  curiosity:
    'Tease a surprising mechanism or hidden cost. Open a loop you only close on slide 2+. ("There\'s a 12-second test that predicts every viral reel.")',
  fear:
    'Name a concrete loss the viewer is already experiencing or about to. Specific, not catastrophic. ("Every DM you don\'t answer in 5 minutes is gone.")',
  authority:
    'Anchor with a defensible number range or a documented industry pattern. No fake stats. ("Roughly 2 in 3 SMBs reply to leads after midnight.")',
  storytelling:
    'Drop into a moment in scene — a single specific second the viewer recognises. No "Imagine if…" framing. ("It\'s 11:47pm. A new lead just messaged. Your phone is silent.")',
  'myth-busting':
    'State a widely-believed claim and immediately reverse it. Concrete, not abstract. ("Posting daily isn\'t the bottleneck. Replying is.")',
  contrarian:
    'Take the opposite position from the mainstream advice in this niche. Be specific about whose advice. ("Stop A/B testing your bio. It doesn\'t matter.")',
  educational:
    'Promise a clean mental model the viewer didn\'t have 60 seconds ago. ("There are only 3 reasons people unfollow. Most brands break all 3.")',
  'list-style':
    'Open with the count + the kicker. The list should feel inevitable, not arbitrary. ("5 lines in your bio that quietly cost you followers.")',
  scarcity:
    'Frame a real, time-bound or quantity-bound loss the viewer faces if they don\'t act. No fake urgency. ("The 4 weeks before Eid: where 60% of your year happens.")',
  controversy:
    'Take a stance most of the niche disagrees with — but defensible. Pick a single concrete claim, not a vibe. ("Stop chasing virality. You don\'t need it to win.")',
  'future-prediction':
    'Make one specific, near-term prediction the viewer can verify. Anchor it to something already visible today. ("In 18 months, every SMB will have an AI receptionist. The early ones already do.")',
  'anti-guru':
    'Reverse a popular guru frame in plain language. Name the trope without naming people. ("\'10x your output\' is the dumbest piece of advice for solo founders.")',
  'data-driven':
    'Open with one defensible figure (range OK, never invent) and the takeaway in the same breath. ("We replied to 312 DMs last month. 9 turned into customers. The pattern repeats.")',
  comparison:
    'Set up A vs B with one sharp differentiator. The viewer should know which side they\'re on by the end of line one. ("Brands that reply in 5 minutes close 4x more than ones that reply in 24 hours.")',
};

export interface HistorySummary {
  recentHooks: string[];
  recentCtas: string[];
  recentHookArchetypes: HookArchetype[];
  recentLayoutArchetypes: LayoutArchetype[];
}

/**
 * Pull the last N carousels for this org. Caps at 20 — anything older isn't
 * "recent" enough to drive anti-repetition usefully.
 */
export async function getRecentHistory(
  orgId: string,
  limit = 12,
): Promise<HistorySummary> {
  const cap = Math.min(20, Math.max(3, limit));
  const { data, error } = await supabase
    .from('generated_carousels')
    .select('hook, cta, metadata, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(cap);
  if (error) throw new DatabaseError(`getRecentHistory: ${error.message}`);

  const rows = data ?? [];
  const recentHooks = rows
    .map((r) => (r.hook ?? '').trim())
    .filter((h) => h.length > 0);
  const recentCtas = rows
    .map((r) => (r.cta ?? '').trim())
    .filter((c) => c.length > 0);

  const recentHookArchetypes: HookArchetype[] = [];
  const recentLayoutArchetypes: LayoutArchetype[] = [];
  for (const r of rows) {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    const ha = md.hook_archetype;
    if (typeof ha === 'string' && (HOOK_ARCHETYPES as readonly string[]).includes(ha)) {
      recentHookArchetypes.push(ha as HookArchetype);
    }
    const las = md.layout_archetypes;
    if (Array.isArray(las)) {
      for (const v of las) {
        if (typeof v === 'string' && (LAYOUT_ARCHETYPES as readonly string[]).includes(v)) {
          recentLayoutArchetypes.push(v as LayoutArchetype);
        }
      }
    }
  }

  return { recentHooks, recentCtas, recentHookArchetypes, recentLayoutArchetypes };
}

/**
 * Pick the next hook archetype. Avoids the last 3 used — if the org has only
 * ever used the same archetype, this guarantees a different one next time.
 *
 * Phase 3D: when `weights` are provided (loaded from content_performance),
 * we keep the anti-repetition rule but bias the pick toward higher-engagement
 * archetypes. A 0.4-engagement archetype is 4× more likely than a 0.1 one.
 * Unweighted archetypes get a floor so brand-new ones still rotate in.
 */
export function pickNextHookArchetype(
  recent: HookArchetype[],
  weights?: Map<string, { sample: number; avgEngagement: number }>,
): HookArchetype {
  const lastThree = new Set(recent.slice(0, 3));
  const candidates = HOOK_ARCHETYPES.filter((a) => !lastThree.has(a));
  const pool = candidates.length > 0 ? candidates : [...HOOK_ARCHETYPES];

  if (!weights || weights.size === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Weighted pick. Floor of 0.05 ensures unobserved archetypes still get
  // explored (epsilon-greedy style — we never collapse to one favourite).
  const FLOOR = 0.05;
  const weighted = pool.map((a) => {
    const w = weights.get(a);
    const v = w ? Math.max(FLOOR, w.avgEngagement) : FLOOR;
    return { a, v };
  });
  const total = weighted.reduce((s, w) => s + w.v, 0);
  let r = Math.random() * total;
  for (const { a, v } of weighted) {
    r -= v;
    if (r <= 0) return a;
  }
  return weighted[weighted.length - 1].a;
}

/**
 * Generic weighted-pick — used to recommend a default style mode when the
 * user hasn't pinned one. Floor + epsilon keeps unobserved styles in play.
 */
export function pickWeightedKey(
  candidates: string[],
  weights: Map<string, { sample: number; avgEngagement: number }>,
  floor = 0.05,
): string | null {
  if (candidates.length === 0) return null;
  if (weights.size === 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  const weighted = candidates.map((k) => {
    const w = weights.get(k);
    const v = w ? Math.max(floor, w.avgEngagement) : floor;
    return { k, v };
  });
  const total = weighted.reduce((s, w) => s + w.v, 0);
  let r = Math.random() * total;
  for (const { k, v } of weighted) {
    r -= v;
    if (r <= 0) return k;
  }
  return weighted[weighted.length - 1].k;
}

/**
 * Pick layout archetypes for a carousel. Returns one per slide, rotating
 * through the pool so visual rhythm varies within AND across carousels.
 */
export function pickLayoutArchetypes(
  slideCount: number,
  recent: LayoutArchetype[],
): LayoutArchetype[] {
  const recentSet = new Set(recent.slice(0, 5));
  const pool: LayoutArchetype[] = LAYOUT_ARCHETYPES.filter((a) => !recentSet.has(a));
  const working = pool.length >= 4 ? pool : [...LAYOUT_ARCHETYPES];
  // Shuffle so each carousel's rhythm is different.
  const shuffled = [...working].sort(() => Math.random() - 0.5);
  const out: LayoutArchetype[] = [];
  for (let i = 0; i < slideCount; i++) {
    out.push(shuffled[i % shuffled.length]);
  }
  return out;
}

/**
 * Render the anti-repetition + archetype guidance for the LLM prompt.
 * Returns an empty string when there's no useful history (fresh workspace).
 */
export function renderAntiRepetitionBlock(
  history: HistorySummary,
  targetArchetype: HookArchetype,
): string {
  const lines: string[] = [];

  lines.push(`HOOK ARCHETYPE FOR THIS POST: ${targetArchetype}`);
  lines.push(ARCHETYPE_GUIDANCE[targetArchetype]);
  lines.push('');

  if (history.recentHooks.length > 0) {
    lines.push('AVOID REPEATING — these are your last hooks. Do not start with the');
    lines.push('same pattern, structure, opening word, or rhetorical move:');
    history.recentHooks.slice(0, 8).forEach((h) => lines.push(`  - "${h}"`));
    lines.push('');
  }

  if (history.recentCtas.length > 0) {
    lines.push('CTA VARIETY — these are your last CTAs. Use a different verb/structure:');
    history.recentCtas.slice(0, 5).forEach((c) => lines.push(`  - "${c}"`));
    lines.push('');
  }

  return lines.join('\n');
}
