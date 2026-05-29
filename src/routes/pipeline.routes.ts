/**
 * Pipeline routes — tenant-scoped.
 *
 *   POST /tenant/pipeline/run         - run the content pipeline (synchronous)
 *   GET  /tenant/pipeline/runs/:id    - inspect a run
 *   POST /tenant/carousels/:id/approve - approve + enqueue a queued carousel
 *   POST /tenant/posts/:id/approve     - approve + enqueue a queued single post
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { NotFoundError, ValidationError } from '../lib/errors';
import { runPipeline } from '../pipeline/pipeline';
import { supabase } from '../lib/supabase';
import {
  enqueuePublish,
  getCarouselByIdScoped,
  getRun,
  listCarouselsForOrg,
  listPipelineRunsForOrg,
  updateCarousel,
  updatePost,
} from '../db/repositories';
import { resolveInstagramAccount } from '../modules/publish/accountService';
import type { PipelineOptions, PostType } from '../types';

const router = Router();
router.use(requireTenant);

/** POST /tenant/pipeline/run — synchronous; check `body.status` to branch. */
router.post(
  '/tenant/pipeline/run',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const opts: PipelineOptions = {
      organizationId: orgId,
      topicId: typeof body.topicId === 'string' ? body.topicId : undefined,
      brandProfileId: typeof body.brandProfileId === 'string' ? body.brandProfileId : undefined,
      templateKey: typeof body.templateKey === 'string' ? body.templateKey : undefined,
      postType: typeof body.postType === 'string' ? (body.postType as PostType) : undefined,
      publishAt: typeof body.publishAt === 'string' ? body.publishAt : undefined,
      approvalMode: body.approvalMode === 'manual' ? 'manual' : 'auto',
      styleModeKey:
        typeof body.styleModeKey === 'string' && body.styleModeKey.length > 0
          ? body.styleModeKey
          : undefined,
    };
    const result = await runPipeline(opts);
    res.json(result);
  }),
);

router.get(
  '/tenant/pipeline/runs',
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const runs = await listPipelineRunsForOrg(req.tenant!.organizationId, limit);
    res.json({ runs });
  }),
);

router.get(
  '/tenant/pipeline/runs/:id',
  asyncHandler(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run || run.organization_id !== req.tenant!.organizationId) {
      throw new NotFoundError(`Run ${req.params.id} not found`);
    }
    res.json(run);
  }),
);

router.get(
  '/tenant/carousels',
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const carousels = await listCarouselsForOrg(req.tenant!.organizationId, { limit, status });
    res.json({ carousels });
  }),
);

router.get(
  '/tenant/carousels/:id',
  asyncHandler(async (req, res) => {
    const row = await getCarouselByIdScoped(req.tenant!.organizationId, req.params.id);
    if (!row) throw new NotFoundError(`Carousel ${req.params.id} not found`);
    res.json({ carousel: row });
  }),
);

/* ---------- approval gates (manual mode) ---------- */

async function loadCarouselScoped(orgId: string, id: string) {
  const { data, error } = await supabase
    .from('generated_carousels')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(`load carousel: ${error.message}`);
  return data as Record<string, unknown> | null;
}

async function loadPostScoped(orgId: string, id: string) {
  const { data, error } = await supabase
    .from('generated_posts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(`load post: ${error.message}`);
  return data as Record<string, unknown> | null;
}

router.post(
  '/tenant/carousels/:id/approve',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const row = await loadCarouselScoped(orgId, req.params.id);
    if (!row) throw new NotFoundError(`Carousel ${req.params.id} not found`);

    const slides = (row.slides as Array<{ imageUrl?: string }>) ?? [];
    const mediaUrls = slides.map((s) => s.imageUrl).filter(Boolean) as string[];
    if (mediaUrls.length < 2) {
      throw new ValidationError(
        `Carousel has only ${mediaUrls.length} rendered slides (need at least 2)`,
      );
    }
    const account = await resolveInstagramAccount(orgId);
    const queued = await enqueuePublish({
      organization_id: orgId,
      carousel_id: req.params.id,
      instagram_account_id: account.id,
      post_type: 'carousel',
      caption: String(row.caption ?? ''),
      hashtags: (row.hashtags as string[]) ?? [],
      media_urls: mediaUrls,
      scheduled_for:
        typeof req.body?.publishAt === 'string'
          ? (req.body.publishAt as string)
          : new Date().toISOString(),
    });
    await updateCarousel(orgId, req.params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
    res.json({ ok: true, publishQueueId: queued.id });
  }),
);

router.post(
  '/tenant/posts/:id/approve',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const row = await loadPostScoped(orgId, req.params.id);
    if (!row) throw new NotFoundError(`Post ${req.params.id} not found`);
    const imageUrl = row.image_url as string | null;
    if (!imageUrl) throw new ValidationError('Post has no rendered image yet');
    const account = await resolveInstagramAccount(orgId);
    const queued = await enqueuePublish({
      organization_id: orgId,
      post_id: req.params.id,
      instagram_account_id: account.id,
      post_type: 'single',
      caption: String(row.caption ?? ''),
      hashtags: (row.hashtags as string[]) ?? [],
      media_urls: [imageUrl],
      scheduled_for:
        typeof req.body?.publishAt === 'string'
          ? (req.body.publishAt as string)
          : new Date().toISOString(),
    });
    await updatePost(orgId, req.params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
    res.json({ ok: true, publishQueueId: queued.id });
  }),
);

export default router;
