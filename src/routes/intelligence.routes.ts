/**
 * Intelligence API — the AI surface that powers Flux v2's command palette,
 * topic engine, hook engine, and AI presence cards.
 *
 *   GET  /api/tenant/intelligence/providers     — provider plane status
 *   POST /api/tenant/intelligence/hooks         — generate N hooks by archetype
 *   POST /api/tenant/intelligence/topics/score  — score one or more topics
 *   GET  /api/tenant/intelligence/insights      — AI cards for Dashboard/Library
 *   POST /api/tenant/intelligence/command       — Cmd-K NL → action
 *   GET  /api/tenant/intelligence/memory/recall — top hooks/themes/CTAs for this brand
 *
 * All endpoints scoped by `x-org-api-key`. All AI calls go through the
 * router (free-tier first, failover, caching, quota tracking).
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, requireTenant } from '../middleware';
import { generationRateLimit } from '../lib/rateLimit';
import { ValidationError, AppError } from '../lib/errors';
import { getOrgById } from '../db/repositories';
import { loadBrandProfile } from '../modules/brand/brandService';
import { completeJsonRouted, providerStatus } from '../ai/router';
import { dailySummary as quotaSummary } from '../ai/quotaTracker';
import { supabase } from '../lib/supabase';
import { HOOK_ARCHETYPES, getRecentHistory } from '../modules/content/historyService';
import { renderPerformanceMemoryBlock } from '../modules/intelligence/memoryPromptBlock';
import { cacheGet, cacheSet, cacheBust } from '../lib/microCache';
import { childLogger } from '../lib/logger';

const router = Router();
router.use(requireTenant);
const log = childLogger({ module: 'intelligence' });

/* ============================================================
 *  /providers — plane status (configured / quota used today / etc.)
 * ============================================================ */

router.get(
  '/tenant/intelligence/providers',
  asyncHandler(async (_req, res) => {
    const usage = await quotaSummary();
    res.json({ providers: providerStatus(), todayUsage: usage });
  }),
);

/* ============================================================
 *  /hooks — generate N hooks for a topic, optionally pinned to an archetype.
 * ============================================================ */

const hooksRequestSchema = z.object({
  topic: z.string().min(2).max(300),
  count: z.number().int().min(1).max(20).optional(),
  archetype: z.enum(HOOK_ARCHETYPES).optional(),
});

const hooksResponseSchema = z.object({
  hooks: z
    .array(
      z.object({
        text: z.string().min(8).max(200),
        archetype: z.enum(HOOK_ARCHETYPES),
        score: z.number().min(0).max(1).optional(),
        why: z.string().max(180).optional(),
      }),
    )
    .min(1)
    .max(20),
});

router.post(
  '/tenant/intelligence/hooks',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = hooksRequestSchema.parse(req.body ?? {});
    const count = body.count ?? 6;

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Org missing', { status: 500, code: 'ORG_MISSING' });
    // Phase 3D follow-up — pull brand voice + recent history + performance
    // memory in parallel so the prompt has every available signal.
    const [brand, history, memoryBlock] = await Promise.all([
      loadBrandProfile(orgId, null),
      getRecentHistory(orgId, 10),
      renderPerformanceMemoryBlock(orgId, { topPerDim: 3 }),
    ]);

    const archetypeLine = body.archetype
      ? `Generate ${count} hooks using the ${body.archetype} archetype.`
      : `Generate ${count} hooks. Rotate archetypes — at least 3 different archetypes across the set.`;

    const system = [
      'You write viral Instagram carousel hooks. You return ONLY JSON.',
      `BRAND VOICE: niche=${brand.niche || 'general'}, tone=${brand.tone || 'direct'}, ${brand.voiceKeywords.length ? `keywords=${brand.voiceKeywords.slice(0, 5).join(', ')}` : ''}${brand.voiceAvoid.length ? `, avoid=${brand.voiceAvoid.slice(0, 5).join(', ')}` : ''}`,
      'Rules:',
      ' - Every hook is one sentence, ≤16 words.',
      ' - NEVER invent precise statistics. Defensible ranges only ("~70%", "2 in 3", "roughly").',
      ' - Pattern-interrupt. Specific verbs. No fluff openers ("let\'s talk", "imagine if").',
      ' - Address the viewer as "you".',
      ' - Each hook gets a confidence score 0-1 reflecting how scroll-stopping it is.',
      history.recentHooks.length
        ? `AVOID repeating these recent hooks: ${history.recentHooks.slice(0, 6).map((h) => `"${h}"`).join(' | ')}`
        : '',
      memoryBlock,
      '',
      `ARCHETYPES (use as the "archetype" field): ${HOOK_ARCHETYPES.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const user = [
      `TOPIC: ${body.topic}`,
      '',
      archetypeLine,
      '',
      'Return ONLY: { "hooks": [{ "text": "...", "archetype": "...", "score": 0.0-1.0, "why": "..." }] }',
    ].join('\n');

    const result = await completeJsonRouted(
      { system, user, schema: hooksResponseSchema, temperature: 0.9, maxTokens: 1500 },
      { tier: 'fast', cacheEnabled: false },
    );
    log.info({ orgId, count: result.hooks.length }, 'hooks generated');
    res.json(result);
  }),
);

/* ============================================================
 *  /topics/score — score one or more proposed topics on SEO + engagement.
 * ============================================================ */

const topicScoreRequestSchema = z.object({
  topics: z.array(z.string().min(2).max(300)).min(1).max(20),
});

const topicScoreResponseSchema = z.object({
  scored: z
    .array(
      z.object({
        topic: z.string(),
        seo_score: z.number().min(0).max(1),
        engagement_score: z.number().min(0).max(1),
        virality_score: z.number().min(0).max(1),
        audience_fit: z.number().min(0).max(1),
        rationale: z.string().max(220),
        suggested_archetype: z.enum(HOOK_ARCHETYPES).optional(),
      }),
    )
    .min(1),
});

router.post(
  '/tenant/intelligence/topics/score',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = topicScoreRequestSchema.parse(req.body ?? {});
    const [brand, memoryBlock] = await Promise.all([
      loadBrandProfile(orgId, null),
      renderPerformanceMemoryBlock(orgId, { topPerDim: 3 }),
    ]);

    const system = [
      'You are a content strategist scoring carousel topics for an SMB Instagram account.',
      `BRAND: niche=${brand.niche || 'general business'}, tone=${brand.tone || 'direct'}, audience reads on mobile.`,
      'Score each topic on FOUR dimensions, each 0.0–1.0:',
      ' - seo_score: how searchable / discoverable the topic is (long-tail keyword density).',
      ' - engagement_score: how likely it is to drive saves/comments/shares.',
      ' - virality_score: how likely it is to break out beyond the existing audience.',
      ' - audience_fit: how aligned it is with this specific brand\'s niche + voice.',
      'Be honest — most topics should land 0.3–0.7. Reserve 0.85+ for genuinely strong picks.',
      memoryBlock,
      'Suggest one hook archetype that would suit the topic from this set: ' + HOOK_ARCHETYPES.join(', '),
    ]
      .filter(Boolean)
      .join('\n');

    const user = [
      'TOPICS TO SCORE:',
      ...body.topics.map((t, i) => `${i + 1}. ${t}`),
      '',
      'Return: { "scored": [{ "topic": "...", "seo_score": 0.0, "engagement_score": 0.0, "virality_score": 0.0, "audience_fit": 0.0, "rationale": "...", "suggested_archetype": "..." }] }',
    ].join('\n');

    const result = await completeJsonRouted(
      { system, user, schema: topicScoreResponseSchema, temperature: 0.4, maxTokens: 2200 },
      { tier: 'balanced', cacheEnabled: true },
    );
    res.json(result);
  }),
);

/* ============================================================
 *  /insights — AI cards for the Dashboard + Library.
 *  Reads cached cards from the ai_insights table, refreshes if stale.
 * ============================================================ */

router.get(
  '/tenant/intelligence/insights',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const surface = (req.query.surface as string) || 'dashboard';

    const key = `insights:${orgId}:${surface}`;
    const cached = cacheGet<unknown[]>(key);
    if (cached !== null) {
      res.json({ insights: cached });
      return;
    }

    const { data, error } = await supabase
      .from('ai_insights')
      .select('id, kind, headline, body, cta_label, cta_href, score, created_at')
      .eq('organization_id', orgId)
      .eq('surface', surface)
      .is('dismissed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('score', { ascending: false })
      .limit(3);
    if (error) throw new AppError(error.message, { status: 500, code: 'INSIGHTS_FETCH' });
    const insights = data ?? [];
    cacheSet(key, insights, 12_000); // 12s; busted on dismiss/refresh
    res.json({ insights });
  }),
);

router.post(
  '/tenant/intelligence/insights/:id/dismiss',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    await supabase
      .from('ai_insights')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .eq('id', req.params.id);
    cacheBust(`insights:${orgId}:`); // drop all surfaces for this org
    res.json({ ok: true });
  }),
);

/* ============================================================
 *  /memory/recall — for the personalization loop.
 *  Returns top-performing hooks/themes/CTAs for the current brand,
 *  ranked by engagement_rate from content_performance.
 * ============================================================ */

router.get(
  '/tenant/intelligence/memory/recall',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;

    const { data: perf } = await supabase
      .from('content_performance')
      .select('hook_archetype, style_mode_key, cta_style, engagement_rate, recorded_at')
      .eq('organization_id', orgId)
      .order('engagement_rate', { ascending: false })
      .limit(50);

    // Aggregate by category.
    const byHook: Record<string, { n: number; avg: number }> = {};
    const byStyle: Record<string, { n: number; avg: number }> = {};
    const byCta: Record<string, { n: number; avg: number }> = {};
    for (const row of perf ?? []) {
      const r = row.engagement_rate ?? 0;
      if (row.hook_archetype) {
        const k = row.hook_archetype;
        const b = byHook[k] ?? { n: 0, avg: 0 };
        byHook[k] = { n: b.n + 1, avg: (b.avg * b.n + r) / (b.n + 1) };
      }
      if (row.style_mode_key) {
        const k = row.style_mode_key;
        const b = byStyle[k] ?? { n: 0, avg: 0 };
        byStyle[k] = { n: b.n + 1, avg: (b.avg * b.n + r) / (b.n + 1) };
      }
      if (row.cta_style) {
        const k = row.cta_style;
        const b = byCta[k] ?? { n: 0, avg: 0 };
        byCta[k] = { n: b.n + 1, avg: (b.avg * b.n + r) / (b.n + 1) };
      }
    }

    const ranked = (m: typeof byHook) =>
      Object.entries(m)
        .map(([k, v]) => ({ key: k, sample_size: v.n, avg_engagement: Number(v.avg.toFixed(4)) }))
        .sort((a, b) => b.avg_engagement - a.avg_engagement);

    res.json({
      sample_size: perf?.length ?? 0,
      top_hooks: ranked(byHook).slice(0, 5),
      top_styles: ranked(byStyle).slice(0, 5),
      top_ctas: ranked(byCta).slice(0, 5),
    });
  }),
);

/* ============================================================
 *  /command — Cmd-K palette intent → action.
 *  Returns a structured action the frontend can execute (route, generate,
 *  rewrite, etc.). The frontend never gets API keys; it just calls
 *  whichever endpoint the action points to.
 * ============================================================ */

const commandRequestSchema = z.object({
  input: z.string().min(1).max(500),
});

const commandResponseSchema = z.object({
  action: z.enum([
    'navigate',
    'generate_topics',
    'run_pipeline',
    'rewrite_caption',
    'switch_theme',
    'show_insights',
    'unknown',
  ]),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  reply: z.string().max(220),
});

router.post(
  '/tenant/intelligence/command',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = commandRequestSchema.parse(req.body ?? {});
    const started = Date.now();

    const system = [
      'You are the command interpreter for Flux. Map the user\'s natural-language input to ONE action.',
      'Allowed actions:',
      ' - navigate { path: string }                    — open a route (/home, /forge, /library, /brand, /signals, /settings)',
      ' - generate_topics { count: number, theme?: string } — fill the topic queue',
      ' - run_pipeline { topicId?: string }            — produce a new carousel',
      ' - rewrite_caption { carouselId: string, style: string } — rewrite a caption',
      ' - switch_theme { themeKey: string }            — switch brand theme',
      ' - show_insights                                — open the opportunity feed on Home',
      ' - unknown                                      — if the input is unclear',
      '',
      'Route map: Home/dashboard→/home, Forge/create/generate→/forge, Library/carousels→/library,',
      'Brand/voice/themes/looks→/brand, Signals/analytics/performance→/signals, Settings→/settings.',
      '',
      'Return: { "action": "...", "args": { ... }, "reply": "short human-readable confirmation" }',
      'If the user said something ambiguous, action=unknown and reply explains why.',
    ].join('\n');

    const result = await completeJsonRouted(
      {
        system,
        user: `Input: "${body.input}"`,
        schema: commandResponseSchema,
        temperature: 0.2,
        maxTokens: 400,
      },
      { tier: 'fast', cacheEnabled: false },
    );

    // Best-effort log to command_history.
    void supabase.from('command_history').insert({
      organization_id: orgId,
      raw_input: body.input,
      parsed_action: result.action,
      arguments: result.args ?? {},
      succeeded: true,
      latency_ms: Date.now() - started,
    });

    res.json(result);
  }),
);

/* ============================================================
 *  /command/history — Sprint C: recent Cmd-K commands for recall.
 *  Returns the org's recent natural-language commands so the palette can
 *  surface a "recent" list the user can one-click re-run.
 * ============================================================ */

router.get(
  '/tenant/intelligence/command/history',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
    const { data, error } = await supabase
      .from('command_history')
      .select('id, raw_input, parsed_action, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new AppError(error.message, { status: 500, code: 'CMD_HISTORY' });
    // De-dup consecutive identical inputs so recall isn't cluttered.
    const seen = new Set<string>();
    const history = (data ?? []).filter((r) => {
      const k = (r.raw_input ?? '').trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    res.json({ history });
  }),
);

/* ============================================================
 *  /styles — list every system style mode + the org's custom ones.
 *  This powers the Studio's 40-mode picker.
 * ============================================================ */

router.get(
  '/tenant/intelligence/styles',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const key = `styles:${orgId}`;
    const cached = cacheGet<unknown[]>(key);
    if (cached !== null) {
      res.json({ styles: cached });
      return;
    }
    const { data, error } = await supabase
      .from('style_modes')
      .select(
        'id, key, name, category, description, emotional_tone, layout, typography, palette, motion, effects, preview_url, is_system, is_premium',
      )
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('is_system', { ascending: false })
      .order('category')
      .order('name');
    if (error) throw new AppError(error.message, { status: 500, code: 'STYLES_FETCH' });
    const styles = data ?? [];
    cacheSet(key, styles, 120_000); // 120s — system style modes change rarely
    res.json({ styles });
  }),
);

/* ============================================================
 *  /insights/refresh — manually regenerate insight cards for this org.
 *  The scheduler also runs this periodically.
 * ============================================================ */

router.post(
  '/tenant/intelligence/insights/refresh',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { generateInsightsForOrg } = await import('../modules/intelligence/insightsGenerator');
    const inserted = await generateInsightsForOrg(orgId);
    cacheBust(`insights:${orgId}:`); // freshly generated — drop stale cache
    res.json({ ok: true, inserted });
  }),
);

/* ============================================================
 *  /assets — Post-audit #3 — asset library listing.
 *  Returns system overlays/textures (organization_id NULL) plus any
 *  per-org custom assets. The Studio's eventual "Asset Browser" UI
 *  consumes this; the renderer references assets by name from style modes.
 * ============================================================ */

router.get(
  '/tenant/assets',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const q = supabase
      .from('asset_library')
      .select('id, kind, name, storage_path, preview_url, metadata, is_system, is_premium, created_at')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('is_system', { ascending: false })
      .order('kind')
      .order('name');
    if (kind) q.eq('kind', kind);
    const { data, error } = await q;
    if (error) throw new AppError(error.message, { status: 500, code: 'ASSETS_FETCH' });
    res.json({ assets: data ?? [] });
  }),
);

/* ============================================================
 *  /weekly-summary/refresh — Sprint E: generate this org's weekly briefing
 *  on demand (the scheduler also runs it Mondays 09:00).
 * ============================================================ */

router.post(
  '/tenant/intelligence/weekly-summary/refresh',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { generateWeeklySummaryForOrg } = await import(
      '../modules/intelligence/weeklySummary'
    );
    const written = await generateWeeklySummaryForOrg(orgId);
    res.json({ ok: true, written });
  }),
);

/* ============================================================
 *  /performance/rollup — Phase 3D manual rollup trigger.
 *  Reads the org's recent analytics and folds them into
 *  content_performance, which drives the bias on future generation.
 *  The scheduler also runs this after every analytics tick.
 * ============================================================ */

router.post(
  '/tenant/intelligence/performance/rollup',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const since = Number(req.body?.sinceHours) || 30 * 24;
    const { rollupOrganizationPerformance } = await import(
      '../modules/intelligence/performanceRollup'
    );
    const result = await rollupOrganizationPerformance(orgId, since);
    res.json({ ok: true, ...result });
  }),
);

/* ============================================================
 *  /performance/top — Phase 3D read API. Returns the same shape as
 *  /memory/recall but loaded through the rollup helper so the floor /
 *  min-samples logic stays consistent. Also exposes which hook would be
 *  picked NEXT given current weights — useful for showing the user
 *  "your next post will lean into <archetype>".
 * ============================================================ */

router.get(
  '/tenant/intelligence/performance/top',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { loadPerformanceWeights } = await import(
      '../modules/intelligence/performanceRollup'
    );
    const w = await loadPerformanceWeights(orgId);

    const serialise = (m: Map<string, { sample: number; avgEngagement: number }>) =>
      [...m.entries()]
        .map(([key, v]) => ({
          key,
          sample_size: v.sample,
          avg_engagement: Number(v.avgEngagement.toFixed(4)),
        }))
        .sort((a, b) => b.avg_engagement - a.avg_engagement);

    res.json({
      sample_size: w.sampleSize,
      top_hooks: serialise(w.byHook).slice(0, 8),
      top_styles: serialise(w.byStyle).slice(0, 8),
      top_ctas: serialise(w.byCta).slice(0, 8),
    });
  }),
);

/* ============================================================
 *  /workspace-mode — get/set the active workspace mode
 *  (creator / campaign / motion / strategy / analytics).
 * ============================================================ */

const WORKSPACE_MODES = ['creator', 'campaign', 'motion', 'strategy', 'analytics'] as const;
type WorkspaceMode = typeof WORKSPACE_MODES[number];

router.get(
  '/tenant/intelligence/workspace-mode',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { data } = await supabase
      .from('workspace_modes')
      .select('mode, metadata, updated_at')
      .eq('organization_id', orgId)
      .maybeSingle();
    res.json({ mode: (data?.mode as WorkspaceMode) || 'creator', metadata: data?.metadata ?? {} });
  }),
);

router.post(
  '/tenant/intelligence/workspace-mode',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const mode = String(req.body?.mode ?? 'creator') as WorkspaceMode;
    if (!WORKSPACE_MODES.includes(mode)) {
      throw new ValidationError(`mode must be one of: ${WORKSPACE_MODES.join(', ')}`);
    }
    await supabase
      .from('workspace_modes')
      .upsert(
        {
          organization_id: orgId,
          mode,
          metadata: req.body?.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id' },
      );
    res.json({ ok: true, mode });
  }),
);

export default router;
