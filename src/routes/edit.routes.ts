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
import { loadTemplate, defaultTemplateKeyForType } from '../modules/templates/templateService';
import { loadStyleMode } from '../modules/styles/loader';
import { composeSlides } from '../modules/render/composer';
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

    const previousSlide = slides[idx];
    const newSlide = await rewriteSlide({
      organization: org,
      brand,
      slide: previousSlide,
      style,
    });
    const updated = await applySlideEdit(orgId, req.params.id, idx, newSlide);
    log.info({ carouselId: req.params.id, idx, style }, 'Slide rewritten');
    // Post-audit #4 — return `previous` and `next` so the UI can render a
    // before/after diff. The full `slides` array is still returned for the
    // existing callers that just refresh state.
    res.json({
      ok: true,
      slides: updated,
      previous: {
        index: previousSlide.index,
        role: previousSlide.role,
        layout: previousSlide.layout,
        data: previousSlide.data,
      },
      next: {
        index: newSlide.index,
        role: newSlide.role,
        layout: newSlide.layout,
        data: newSlide.data,
      },
      style,
    });
  }),
);

/* ----- Post-audit #4 — live theme reapply (no full pipeline rerun) ----- */
// Re-renders an existing carousel's slides under a different style mode.
// Skips: topic resolution, content generation, brand load — keeps the same
// per-slide copy and only swaps the visual layer. Costs ~1 PNG per slide
// instead of a fresh LLM call + every other step.

router.post(
  '/tenant/carousels/:id/restyle',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const carouselId = req.params.id;
    const styleModeKey = typeof req.body?.styleModeKey === 'string' ? req.body.styleModeKey : null;
    if (!styleModeKey) {
      throw new ValidationError('Field "styleModeKey" is required');
    }

    const carousel = await getCarouselByIdScoped(orgId, carouselId);
    if (!carousel) throw new NotFoundError(`Carousel ${carouselId} not found`);
    const slides = (carousel.slides as SlideContent[] | null) ?? [];
    if (slides.length === 0) {
      throw new ValidationError('Carousel has no slides — cannot restyle');
    }

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Organization vanished', { status: 500, code: 'ORG_MISSING' });
    const brand = await loadBrandProfile(orgId, carousel.brand_profile_id ?? null);
    // The carousel row stores a template_id; we don't strictly need it to
    // re-render — the existing slides already carry the layout per slide.
    // Pick the default carousel template (or single-post template) so the
    // composer has a valid Template object.
    const templateKey = defaultTemplateKeyForType('carousel');
    const template = await loadTemplate(org.id, templateKey);
    const styleMode = await loadStyleMode(orgId, styleModeKey);
    if (!styleMode) {
      throw new ValidationError(`Style mode "${styleModeKey}" not found`);
    }

    log.info({ carouselId, styleModeKey, slideCount: slides.length }, 'Restyling carousel');
    const rendered = await composeSlides({
      orgId,
      runId: (carousel.run_id as string | null) ?? carouselId, // group new renders under the run if present
      brand,
      template,
      slides,
      styleMode,
    });

    // Persist new URLs back onto the carousel slides + bump style_mode_key
    // in metadata so the performance rollup picks up the new style on
    // subsequent analytics syncs.
    const slidesWithUrls = slides.map((s, i) => ({
      ...s,
      imageUrl: rendered[i]?.publicUrl,
      storagePath: rendered[i]?.storagePath,
    }));
    const oldMetadata = (carousel.metadata as Record<string, unknown> | null) ?? {};
    await updateCarousel(orgId, carouselId, {
      slides: slidesWithUrls as unknown as Record<string, unknown>,
      metadata: {
        ...oldMetadata,
        style_mode_key: styleModeKey,
        last_restyle_at: new Date().toISOString(),
      } as Record<string, unknown>,
    });

    res.json({
      ok: true,
      carouselId,
      styleModeKey,
      slides: slidesWithUrls,
      imageUrls: rendered.map((r) => r.publicUrl),
    });
  }),
);

/* ----- Sprint D — render a draft carousel (after inline edits) ----- */
// Renders the carousel's CURRENT (possibly edited) slide text into images
// under its existing style mode, then flips status draft → ready. The Forge
// calls this when the user finishes editing the streamed draft.
router.post(
  '/tenant/carousels/:id/render',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const carouselId = req.params.id;

    const carousel = await getCarouselByIdScoped(orgId, carouselId);
    if (!carousel) throw new NotFoundError(`Carousel ${carouselId} not found`);
    const slides = (carousel.slides as SlideContent[] | null) ?? [];
    if (slides.length === 0) throw new ValidationError('Carousel has no slides to render');

    const org = await getOrgById(orgId);
    if (!org) throw new AppError('Organization vanished', { status: 500, code: 'ORG_MISSING' });
    const brand = await loadBrandProfile(orgId, carousel.brand_profile_id ?? null);
    const template = await loadTemplate(org.id, defaultTemplateKeyForType('carousel'));

    const meta = (carousel.metadata as Record<string, unknown> | null) ?? {};
    const styleKey =
      (typeof req.body?.styleModeKey === 'string' && req.body.styleModeKey) ||
      (meta.style_mode_key as string | undefined) ||
      undefined;
    const styleMode = styleKey ? await loadStyleMode(orgId, styleKey) : null;

    log.info({ carouselId, styleKey, slideCount: slides.length }, 'Rendering draft carousel');
    const rendered = await composeSlides({
      orgId,
      runId: (carousel.run_id as string | null) ?? carouselId,
      brand,
      template,
      slides,
      styleMode,
    });

    const slidesWithUrls = slides.map((s, i) => ({
      ...s,
      imageUrl: rendered[i]?.publicUrl,
      storagePath: rendered[i]?.storagePath,
    }));
    await updateCarousel(orgId, carouselId, {
      slides: slidesWithUrls as unknown as Record<string, unknown>,
      status: 'ready',
      metadata: { ...meta, rendered_at: new Date().toISOString() } as Record<string, unknown>,
    });

    res.json({
      ok: true,
      carouselId,
      status: 'ready',
      slides: slidesWithUrls,
      imageUrls: rendered.map((r) => r.publicUrl),
    });
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
