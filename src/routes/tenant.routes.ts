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
} from '../db/repositories';
import { supabase } from '../lib/supabase';
import { loadBrandProfile } from '../modules/brand/brandService';
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
    const overview = await getOrgOverview(req.tenant!.organizationId);
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

router.post(
  '/tenant/brand',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Partial<BrandProfileRow>;
    if (!body.name || typeof body.name !== 'string') {
      throw new ValidationError('Field "name" is required');
    }
    const row = await createBrand({ ...body, organization_id: orgId });
    res.status(201).json({ brand: row });
  }),
);

router.patch(
  '/tenant/brand/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    await updateBrand(orgId, req.params.id, req.body ?? {});
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

export default router;
