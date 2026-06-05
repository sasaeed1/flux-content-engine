/**
 * Multi-platform publishing routes.
 *
 *   GET    /tenant/connections                  — platform catalog + connected accounts
 *   POST   /tenant/connections                  — connect an account { platform, fields }
 *   DELETE /tenant/connections/:id              — disconnect
 *   POST   /tenant/carousels/:id/publish-to     — publish a carousel to { connectionIds[] }
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { generationRateLimit } from '../lib/rateLimit';
import { ValidationError, NotFoundError } from '../lib/errors';
import { getCarouselByIdScoped } from '../db/repositories';
import {
  connectAccount,
  disconnectAccount,
  listConnections,
  platformCatalog,
  publicConnection,
  publishToConnections,
} from '../modules/publish/socialConnectionService';

const router = Router();
router.use(requireTenant);

router.get(
  '/tenant/connections',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const conns = await listConnections(orgId);
    res.json({ platforms: platformCatalog(), connections: conns.map(publicConnection) });
  }),
);

router.post(
  '/tenant/connections',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as { platform?: string; fields?: Record<string, string> };
    if (!body.platform || typeof body.platform !== 'string') {
      throw new ValidationError('platform is required');
    }
    const conn = await connectAccount(orgId, body.platform, body.fields ?? {});
    res.status(201).json({ connection: publicConnection(conn) });
  }),
);

router.delete(
  '/tenant/connections/:id',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    await disconnectAccount(orgId, req.params.id);
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant/carousels/:id/publish-to',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const ids = Array.isArray(req.body?.connectionIds)
      ? (req.body.connectionIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    if (ids.length === 0) throw new ValidationError('connectionIds[] is required');

    const carousel = await getCarouselByIdScoped(orgId, req.params.id);
    if (!carousel) throw new NotFoundError(`Carousel ${req.params.id} not found`);
    const slides = (carousel.slides as Array<{ imageUrl?: string }>) ?? [];
    const mediaUrls = slides.map((s) => s.imageUrl).filter((u): u is string => Boolean(u));
    if (mediaUrls.length === 0) {
      throw new ValidationError('This carousel has no rendered slides to publish.');
    }

    const results = await publishToConnections(orgId, ids, {
      kind: 'carousel',
      caption: String(carousel.caption ?? ''),
      hashtags: (carousel.hashtags as string[]) ?? [],
      mediaUrls,
    });
    res.json({ results });
  }),
);

export default router;
