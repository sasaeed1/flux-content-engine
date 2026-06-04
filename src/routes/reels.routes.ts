/**
 * Reel routes — org-scoped (`x-org-api-key`) motion/reel generation + listing.
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { generationRateLimit } from '../lib/rateLimit';
import { ValidationError } from '../lib/errors';
import { env } from '../config/env';
import { startReelGeneration } from '../modules/motion/motionService';
import { getReelByIdScoped, listReelsForCarousel, listReelsForOrg } from '../db/repositories';
import type { ReelAspect } from '../modules/motion/types';

const router = Router();
router.use(requireTenant);

const ASPECTS: ReelAspect[] = ['reel', 'square', 'portrait'];

/* ---------- list reels (optionally scoped to a carousel) ---------- */
router.get(
  '/tenant/reels',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const carouselId = typeof req.query.carouselId === 'string' ? req.query.carouselId : undefined;
    const reels = carouselId
      ? await listReelsForCarousel(orgId, carouselId)
      : await listReelsForOrg(orgId);
    res.json({ reels });
  }),
);

router.get(
  '/tenant/reels/:id',
  asyncHandler(async (req, res) => {
    const reel = await getReelByIdScoped(req.tenant!.organizationId, req.params.id);
    if (!reel) throw new ValidationError('Reel not found');
    res.json({ reel });
  }),
);

/* ---------- generate a reel from a carousel ----------
 * Async: returns a `processing` reel immediately; the ffmpeg render runs in
 * the background and flips the row to `ready`. Poll GET /tenant/reels/:id. */
router.post(
  '/tenant/reels',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    if (!env.ENABLE_MOTION) {
      throw new ValidationError('Motion engine is disabled (ENABLE_MOTION=false)');
    }
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as {
      carouselId?: string;
      aspect?: string;
      presetKey?: string;
      kinetic?: boolean;
    };
    if (!body.carouselId || typeof body.carouselId !== 'string') {
      throw new ValidationError('Field "carouselId" is required');
    }
    const aspect = ASPECTS.includes(body.aspect as ReelAspect)
      ? (body.aspect as ReelAspect)
      : undefined;

    const reel = await startReelGeneration({
      orgId,
      carouselId: body.carouselId,
      aspect,
      presetKey: typeof body.presetKey === 'string' ? body.presetKey : undefined,
      kinetic: body.kinetic === true,
    });
    res.status(202).json({ reel });
  }),
);

export default router;
