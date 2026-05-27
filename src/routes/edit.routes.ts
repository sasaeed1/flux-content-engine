/**
 * Post-generation editing routes.
 *
 *   POST /tenant/carousels/:id/caption              { caption }            — direct edit
 *   POST /tenant/carousels/:id/caption/rewrite      { style }              — AI rewrite
 *   POST /tenant/carousels/:id/cta                  { cta }                — direct edit
 *   POST /tenant/carousels/:id/cta/rewrite          { variations?: 3 }     — propose alternatives
 *   POST /tenant/carousels/:id/slides/:idx          { data }               — direct slide edit
 *   POST /tenant/carousels/:id/slides/:idx/rewrite  { style }              — AI rewrite slide
 *   POST /tenant/carousels/bulk/approve             { carouselIds[], publishAt? }
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { ValidationError, NotFoundError, AppError } from '../lib/errors';
import {
  getOrgById,
  getCarouselByIdScoped,
  updateCarousel,
} from '../db/repositories';
import { loadBrandProfile } from '../modules/brand/brandService';
import { resolveInstagramAccount } from '../modules/publish/accountService';
import { enqueuePublish } from '../db/repositories';
import {
  rewriteCaption,
  rewriteCta,
  rewriteSlide,
  applyCaptionEdit,
  applyCtaEdit,
  applySlideEdit,
  type CaptionStyle,
  type SlideEditStyle,
} from '../modules/content/editService';
import { childLogger } from '../lib/logger';
import type { SlideContent } from '../types';

const router = Router();
router.use(requireTenant);
const log = childLogger({ module: 'edit-routes' });

const CAPTION_STYLES = new Set<CaptionStyle>([
  'shorter', 'longer', 'professional', 'casual', 'aggressive', 'stronger-cta', 'rewrite',
]);
const SLIDE_STYLES = new Set<SlideEditStyle>([
  'rewrite', 'shorter', 'denser', 'rewrite-hook', 'rewrite-cta',
]);

/* ----- caption ----- */

router.post(
  '/tenant/carousels/:id/caption',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const caption = String(req.body?.caption ?? '');
    await applyCaptionEdit(orgId, req.params.id, caption);
    res.json({ ok: true, caption });
  }),
);

router.post(
  '/tenant/carousels/:id/caption/rewrite',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const style = String(req.body?.style ?? 'rewrite') as CaptionStyle;
    if (!CAPTION_STYLES.has(style)) {
      throw new ValidationError(
        `style must be one of: ${[...CAPTION_STYLES].join(', ')}`,
      );
    }

    const carousel = await getCarouselByIdScoped(orgId, req.params.id);
    if (!carousel) throw new NotFoundError(`Carousel ${req.params.id} not found`);

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Organization vanished', { status: 500, code: 'ORG_MISSING' });
    const brand = await loadBrandProfile(orgId, carousel.brand_profile_id ?? null);

    const newCaption = await rewriteCaption({
      organization: org,
      brand,
      current: String(carousel.caption ?? ''),
      style,
    });
    await applyCaptionEdit(orgId, req.params.id, newCaption);
    log.info({ carouselId: req.params.id, style }, 'Caption rewritten');
    res.json({ ok: true, caption: newCaption });
  }),
);

/* ----- cta ----- */

router.post(
  '/tenant/carousels/:id/cta',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const cta = String(req.body?.cta ?? '');
    await applyCtaEdit(orgId, req.params.id, cta);
    res.json({ ok: true, cta });
  }),
);

router.post(
  '/tenant/carousels/:id/cta/rewrite',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const variations = Math.max(1, Math.min(6, Number(req.body?.variations) || 3));

    const carousel = await getCarouselByIdScoped(orgId, req.params.id);
    if (!carousel) throw new NotFoundError(`Carousel ${req.params.id} not found`);

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Organization vanished', { status: 500, code: 'ORG_MISSING' });
    const brand = await loadBrandProfile(orgId, carousel.brand_profile_id ?? null);

    const ctas = await rewriteCta({
      organization: org,
      brand,
      current: String(carousel.cta ?? ''),
      variations,
    });
    res.json({ ok: true, ctas });
  }),
);

/* ----- slides ----- */

router.post(
  '/tenant/carousels/:id/slides/:idx',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      throw new ValidationError('Slide index must be a non-negative integer');
    }
    const data = req.body?.data;
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Field "data" (object) is required');
    }
    const carousel = await getCarouselByIdScoped(orgId, req.params.id);
    if (!carousel) throw new NotFoundError(`Carousel ${req.params.id} not found`);
    const slides = (carousel.slides as SlideContent[] | null) ?? [];
    if (idx >= slides.length) throw new ValidationError(`Slide index ${idx} out of range`);

    const updated = await applySlideEdit(orgId, req.params.id, idx, {
      ...slides[idx],
      data: data as SlideContent['data'],
    });
    res.json({ ok: true, slides: updated });
  }),
);

router.post(
  '/tenant/carousels/:id/slides/:idx/rewrite',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0) {
      throw new ValidationError('Slide index must be a non-negative integer');
    }
    const style = String(req.body?.style ?? 'rewrite') as SlideEditStyle;
    if (!SLIDE_STYLES.has(style)) {
      throw new ValidationError(
        `style must be one of: ${[...SLIDE_STYLES].join(', ')}`,
      );
    }

    const carousel = await getCarouselByIdScoped(orgId, req.params.id);
    if (!carousel) throw new NotFoundError(`Carousel ${req.params.id} not found`);
    const slides = (carousel.slides as SlideContent[] | null) ?? [];
    if (idx >= slides.length) throw new ValidationError(`Slide index ${idx} out of range`);

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Organization vanished', { status: 500, code: 'ORG_MISSING' });
    const brand = await loadBrandProfile(orgId, carousel.brand_profile_id ?? null);

    const newSlide = await rewriteSlide({
      organization: org,
      brand,
      slide: slides[idx],
      style,
    });
    const updated = await applySlideEdit(orgId, req.params.id, idx, newSlide);
    log.info({ carouselId: req.params.id, idx, style }, 'Slide rewritten');
    res.json({ ok: true, slides: updated });
  }),
);

/* ----- bulk approve ----- */

router.post(
  '/tenant/carousels/bulk/approve',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const ids = req.body?.carouselIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('carouselIds[] is required');
    }
    if (ids.length > 25) {
      throw new ValidationError('Cannot bulk-approve more than 25 carousels at once');
    }
    const publishAt =
      typeof req.body?.publishAt === 'string'
        ? (req.body.publishAt as string)
        : new Date().toISOString();

    const account = await resolveInstagramAccount(orgId);

    const results: Array<{
      id: string;
      ok: boolean;
      publishQueueId?: string;
      error?: string;
    }> = [];

    for (const rawId of ids) {
      const id = String(rawId);
      try {
        const row = await getCarouselByIdScoped(orgId, id);
        if (!row) {
          results.push({ id, ok: false, error: 'not_found' });
          continue;
        }
        const slides = (row.slides as Array<{ imageUrl?: string }>) ?? [];
        const mediaUrls = slides.map((s) => s.imageUrl).filter(Boolean) as string[];
        if (mediaUrls.length < 2) {
          results.push({ id, ok: false, error: 'insufficient_slides' });
          continue;
        }
        const queued = await enqueuePublish({
          organization_id: orgId,
          carousel_id: id,
          instagram_account_id: account.id,
          post_type: 'carousel',
          caption: String(row.caption ?? ''),
          hashtags: (row.hashtags as string[]) ?? [],
          media_urls: mediaUrls,
          scheduled_for: publishAt,
        });
        await updateCarousel(orgId, id, {
          status: 'approved',
          approved_at: new Date().toISOString(),
        });
        results.push({ id, ok: true, publishQueueId: queued.id });
      } catch (err) {
        results.push({
          id,
          ok: false,
          error: err instanceof Error ? err.message : 'unknown_error',
        });
      }
    }

    log.info(
      { orgId, requested: ids.length, succeeded: results.filter((r) => r.ok).length },
      'Bulk approve complete',
    );
    res.json({ ok: true, results });
  }),
);

export default router;
