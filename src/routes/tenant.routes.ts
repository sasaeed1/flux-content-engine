/**
 * Tenant routes — org-scoped (`x-org-api-key`).
 * Surface for the dashboard + WappFlow module integration.
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { ValidationError } from '../lib/errors';
import {
  getOrgById,
  getOrgOverview,
  listBrandsForOrg,
  getDefaultBrandForOrg,
  createBrand,
  updateBrand,
  listTemplatesForOrg,
  listThemes,
  insertTopics,
  getNextPendingTopic,
  listInstagramAccounts,
  createInstagramAccount,
  getThemeByKey,
} from '../db/repositories';
import { supabase } from '../lib/supabase';
import { uploadBuffer, storagePaths } from '../lib/storage';
import { cacheGet, cacheSet } from '../lib/microCache';
import { env } from '../config/env';
import crypto from 'node:crypto';
import { loadBrandProfile } from '../modules/brand/brandService';
import {
  extractDnaForAsset,
  dnaToBrandPatch,
  type ProposedBrandDna,
} from '../modules/brand/dnaExtractor';
import { generateAndInsertTopics } from '../modules/topics/topicService';
import type { ContentTopicRow, BrandProfileRow } from '../types';

const router = Router();
router.use(requireTenant);

/* ---------- /tenant/me ---------- */

router.get(
  '/tenant/me',
  asyncHandler(async (req, res) => {
    const org = await getOrgById(req.tenant!.organizationId);
    res.json({ organization: org });
  }),
);

router.get(
  '/tenant/overview',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const key = `overview:${orgId}`;
    const cached = cacheGet<unknown>(key);
    if (cached !== null) {
      res.json({ overview: cached });
      return;
    }
    const overview = await getOrgOverview(orgId);
    cacheSet(key, overview, 15_000); // 15s — stats tolerate brief staleness
    res.json({ overview });
  }),
);

/* ---------- /tenant/themes ---------- */

router.get(
  '/tenant/themes',
  asyncHandler(async (_req, res) => {
    res.json({ themes: await listThemes() });
  }),
);

/* ---------- /tenant/templates ---------- */

router.get(
  '/tenant/templates',
  asyncHandler(async (req, res) => {
    res.json({ templates: await listTemplatesForOrg(req.tenant!.organizationId) });
  }),
);

/* ---------- /tenant/brand ---------- */

router.get(
  '/tenant/brand',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const defaultBrand = await getDefaultBrandForOrg(orgId);
    const all = await listBrandsForOrg(orgId);
    const resolved = defaultBrand ? await loadBrandProfile(orgId, defaultBrand.id) : null;
    res.json({ default: resolved, all });
  }),
);

/**
 * Translate the UI-friendly `themePresetKey` into the DB-friendly
 * `themePresetId` (a UUID FK). The brand_profiles table only has the FK.
 * Returns a new body object with the substitution applied.
 */
async function resolveThemePresetKey(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const next = { ...body };
  if ('themePresetKey' in next) {
    const key = next.themePresetKey;
    delete next.themePresetKey;
    if (typeof key === 'string' && key.trim().length > 0) {
      const preset = await getThemeByKey(key.trim());
      if (!preset) {
        throw new ValidationError(`Unknown theme preset key "${key}"`);
      }
      next.themePresetId = preset.id;
    } else {
      // Empty / null → explicit clear.
      next.themePresetId = null;
    }
  }
  return next;
}

router.post(
  '/tenant/brand',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!body.name || typeof body.name !== 'string') {
      throw new ValidationError('Field "name" is required');
    }
    const resolved = await resolveThemePresetKey(body);
    const row = await createBrand({
      ...(resolved as Partial<BrandProfileRow>),
      organization_id: orgId,
    });
    res.status(201).json({ brand: row });
  }),
);

router.patch(
  '/tenant/brand/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const resolved = await resolveThemePresetKey((req.body ?? {}) as Record<string, unknown>);
    await updateBrand(orgId, req.params.id, resolved as Partial<BrandProfileRow>);
    res.json({ ok: true });
  }),
);

/* ---------- /tenant/topics ---------- */

router.get(
  '/tenant/topics/next',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const calendarId = (req.query.calendarId as string | undefined) ?? undefined;
    const topic = await getNextPendingTopic(orgId, calendarId);
    res.json({ topic });
  }),
);

// Sprint G — list topics for the Campaign calendar. Optional from/to (YYYY-MM-DD)
// to scope to a visible month.
router.get(
  '/tenant/topics',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    let q = supabase
      .from('content_topics')
      .select('id, topic, angle, post_type, scheduled_date, priority, status, created_at')
      .eq('organization_id', orgId)
      .order('scheduled_date', { ascending: true })
      .limit(400);
    if (from) q = q.gte('scheduled_date', from);
    if (to) q = q.lte('scheduled_date', to);
    const { data, error } = await q;
    if (error) throw new ValidationError(error.message);
    res.json({ topics: data ?? [] });
  }),
);

// Sprint G — reschedule / update a topic (drag-to-reschedule on the calendar).
router.patch(
  '/tenant/topics/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as { scheduledDate?: string; status?: string; priority?: number };
    const patch: Record<string, unknown> = {};
    if (typeof body.scheduledDate === 'string') patch.scheduled_date = body.scheduledDate;
    if (typeof body.status === 'string') patch.status = body.status;
    if (typeof body.priority === 'number') patch.priority = body.priority;
    if (Object.keys(patch).length === 0) {
      throw new ValidationError('Provide scheduledDate, status, or priority');
    }
    const { data, error } = await supabase
      .from('content_topics')
      .update(patch)
      .eq('organization_id', orgId)
      .eq('id', req.params.id)
      .select('id, topic, scheduled_date, status')
      .maybeSingle();
    if (error) throw new ValidationError(error.message);
    if (!data) throw new ValidationError('Topic not found');
    res.json({ ok: true, topic: data });
  }),
);

// Sprint G — delete a topic from the calendar.
router.delete(
  '/tenant/topics/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { error } = await supabase
      .from('content_topics')
      .delete()
      .eq('organization_id', orgId)
      .eq('id', req.params.id);
    if (error) throw new ValidationError(error.message);
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant/topics',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const list = (req.body?.topics ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(list) || list.length === 0) {
      throw new ValidationError('Body must contain a non-empty "topics" array');
    }
    const rows: Array<Partial<ContentTopicRow>> = list.map((t) => {
      if (!t.topic || typeof t.topic !== 'string') {
        throw new ValidationError('Each topic needs a non-empty "topic" string');
      }
      return {
        organization_id: orgId,
        calendar_id: typeof t.calendarId === 'string' ? t.calendarId : null,
        topic: t.topic,
        angle: typeof t.angle === 'string' ? t.angle : null,
        post_type:
          typeof t.postType === 'string'
            ? (t.postType as ContentTopicRow['post_type'])
            : 'carousel',
        scheduled_date:
          typeof t.scheduledDate === 'string'
            ? t.scheduledDate
            : new Date().toISOString().slice(0, 10),
        priority: typeof t.priority === 'number' ? t.priority : 0,
        source: 'manual',
      };
    });
    const inserted = await insertTopics(rows);
    res.status(201).json({ inserted: inserted.length, topics: inserted });
  }),
);

router.post(
  '/tenant/topics/generate',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const count = Math.min(20, Math.max(1, Number(req.body?.count) || 5));
    const themeHint =
      typeof req.body?.themeHint === 'string' ? (req.body.themeHint as string) : undefined;
    const org = await getOrgById(orgId);
    if (!org) {
      throw new ValidationError('Organization vanished');
    }
    const brand = await loadBrandProfile(orgId);
    const inserted = await generateAndInsertTopics({
      organization: org,
      brand,
      count,
      themeHint,
    });
    res.status(201).json({ inserted: inserted.length, topics: inserted });
  }),
);

/* ---------- /tenant/instagram-accounts ---------- */

router.get(
  '/tenant/instagram-accounts',
  asyncHandler(async (req, res) => {
    const rows = await listInstagramAccounts(req.tenant!.organizationId);
    // never echo access tokens
    res.json({
      accounts: rows.map((r) => ({ ...r, ig_access_token: undefined })),
    });
  }),
);

router.post(
  '/tenant/instagram-accounts',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as {
      igBusinessAccountId?: string;
      accessToken?: string;
      username?: string;
      makeDefault?: boolean;
    };
    if (!body.igBusinessAccountId || !body.accessToken) {
      throw new ValidationError(
        'Both "igBusinessAccountId" and "accessToken" are required',
      );
    }
    // If makeDefault, demote existing defaults first.
    if (body.makeDefault) {
      await supabase
        .from('instagram_accounts')
        .update({ is_default: false })
        .eq('organization_id', orgId);
    }
    const row = await createInstagramAccount({
      organization_id: orgId,
      ig_business_account_id: body.igBusinessAccountId,
      ig_access_token: body.accessToken,
      username: body.username ?? null,
      active: true,
      is_default: body.makeDefault ?? true,
    });
    res.status(201).json({
      account: { ...row, ig_access_token: undefined },
    });
  }),
);

router.delete(
  '/tenant/instagram-accounts/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    // Soft-delete: mark inactive so existing scheduled rows still resolve.
    const { error } = await supabase
      .from('instagram_accounts')
      .update({ active: false, is_default: false })
      .eq('organization_id', orgId)
      .eq('id', req.params.id);
    if (error) throw new ValidationError(error.message);
    res.json({ ok: true });
  }),
);

/* ---------- /tenant/brand/assets — Brand Kit uploads ---------- */
// Stores brand reference materials (logo PNGs, brand-book PDFs, style guides)
// in the logo bucket under orgs/<id>/brand-kit/. AI extraction of colors/tone
// from these assets is a follow-up — for now the upload endpoint just
// preserves them so we can extract later.

const ALLOWED_BRAND_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

router.get(
  '/tenant/brand/assets',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const { data, error } = await supabase
      .from('generated_assets')
      .select('id, type, provider, storage_path, public_url, bytes, created_at, metadata')
      .eq('organization_id', orgId)
      .eq('provider', 'brand-kit')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new ValidationError(error.message);
    res.json({ assets: data ?? [] });
  }),
);

router.post(
  '/tenant/brand/assets',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as {
      filename?: string;
      contentType?: string;
      // base64-encoded file body — keeps us off multer for now.
      data?: string;
      // optional user-supplied label
      label?: string;
    };
    if (!body.data || !body.contentType || !body.filename) {
      throw new ValidationError('Fields "filename", "contentType" and "data" (base64) are required');
    }
    const ext = ALLOWED_BRAND_MIME[body.contentType.toLowerCase()];
    if (!ext) {
      throw new ValidationError(
        `Unsupported file type "${body.contentType}". Accepted: PDF, PNG, JPG, SVG, WebP.`,
      );
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(body.data, 'base64');
    } catch {
      throw new ValidationError('Invalid base64 data');
    }
    const maxBytes = 10 * 1024 * 1024; // 10 MB cap
    if (buffer.length === 0) throw new ValidationError('Empty file');
    if (buffer.length > maxBytes) {
      throw new ValidationError(
        `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max 10MB.`,
      );
    }
    const assetId = crypto.randomUUID();
    const path = storagePaths.brandAsset(orgId, assetId, ext);
    const upload = await uploadBuffer({
      bucket: env.SUPABASE_LOGO_BUCKET,
      path,
      body: buffer,
      contentType: body.contentType,
    });

    const { data: row, error } = await supabase
      .from('generated_assets')
      .insert({
        id: assetId,
        organization_id: orgId,
        type: 'upload',
        provider: 'brand-kit',
        storage_path: upload.path,
        public_url: upload.publicUrl,
        bytes: buffer.length,
        metadata: {
          original_filename: body.filename,
          content_type: body.contentType,
          label: body.label ?? null,
          // AI extraction status — populated when we add the extractor.
          extraction: { status: 'pending', extracted_at: null },
        },
      })
      .select('*')
      .single();
    if (error) throw new ValidationError(error.message);

    res.status(201).json({ asset: row });
  }),
);

router.delete(
  '/tenant/brand/assets/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const id = req.params.id;
    // Lookup the row to find the storage path.
    const { data: row, error: lookupErr } = await supabase
      .from('generated_assets')
      .select('storage_path')
      .eq('organization_id', orgId)
      .eq('id', id)
      .eq('provider', 'brand-kit')
      .maybeSingle();
    if (lookupErr) throw new ValidationError(lookupErr.message);
    if (!row) throw new ValidationError('Asset not found');

    // Best-effort storage cleanup; non-fatal if it fails.
    if (row.storage_path) {
      await supabase.storage.from(env.SUPABASE_LOGO_BUCKET).remove([row.storage_path]);
    }
    const { error } = await supabase
      .from('generated_assets')
      .delete()
      .eq('organization_id', orgId)
      .eq('id', id);
    if (error) throw new ValidationError(error.message);
    res.json({ ok: true });
  }),
);

/* ---------- /tenant/brand/assets/:id/extract — Phase 3C Brand DNA ---------- */
// Runs the dnaExtractor against a single uploaded asset and stores the proposal
// in the asset's metadata.extraction. The web UI calls this from the Brand
// page when the user clicks "Extract brand DNA" on an asset.
//
// Worth noting: this is intentionally synchronous. Extraction is dominated by
// a single LLM call (~1-3s) + a sharp histogram pass (~200ms) — fast enough to
// resolve inside the HTTP request. If we add PDF rasterisation later we'll
// flip this to a background job.
router.post(
  '/tenant/brand/assets/:id/extract',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const id = req.params.id;
    const result = await extractDnaForAsset(orgId, id);
    res.json({ ok: true, ...result });
  }),
);

/* ---------- /tenant/brand/dna/apply — accept an extracted proposal ---------- */
// Takes a previously-extracted (or hand-edited) DNA proposal and applies the
// accepted slots to the default brand profile. The user picks which slots to
// accept in the review modal — this endpoint just does the merge.
router.post(
  '/tenant/brand/dna/apply',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as {
      brandId?: string;
      proposed?: ProposedBrandDna;
      accept?: Array<string>;
    };
    if (!body.proposed) {
      throw new ValidationError('Body must include "proposed" (the DNA object)');
    }
    // Resolve target brand — explicit id or default for org.
    let targetBrandId = body.brandId;
    if (!targetBrandId) {
      const def = await getDefaultBrandForOrg(orgId);
      if (!def) throw new ValidationError('No default brand for this org — create one first');
      targetBrandId = def.id;
    }
    const patch = dnaToBrandPatch(
      body.proposed,
      { accept: body.accept as never },
    );
    if (Object.keys(patch).length === 0) {
      throw new ValidationError(
        'Nothing to apply — proposal was empty for the accepted slots',
      );
    }
    await updateBrand(orgId, targetBrandId, patch as Partial<BrandProfileRow>);
    res.json({ ok: true, brandId: targetBrandId, applied: Object.keys(patch) });
  }),
);

export default router;
