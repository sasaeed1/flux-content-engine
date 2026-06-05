/**
 * AI Media Intelligence Studio routes (Phase 1 — images).
 *
 *   GET    /tenant/media               — list assets, ranked by quality
 *   POST   /tenant/media               — upload { filename, contentType, data(base64) } → analyze
 *   POST   /tenant/media/director      — LLM creative-director verdict over the set
 *   POST   /tenant/media/:id/enhance   — enhance { upscale?, brandGrade?, intensity? }
 *   DELETE /tenant/media/:id           — remove an asset
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { generationRateLimit } from '../lib/rateLimit';
import { ValidationError } from '../lib/errors';
import {
  backgroundAsset,
  deleteAsset,
  directorVerdict,
  enhanceAsset,
  listAssets,
  reframeAsset,
  uploadAndAnalyze,
} from '../modules/media/mediaService';

const router = Router();
router.use(requireTenant);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB raw (base64 stays under the 16MB JSON limit)

function decodeBase64(data: string): Buffer {
  const comma = data.indexOf(',');
  const b64 = data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
  return Buffer.from(b64, 'base64');
}

router.get(
  '/tenant/media',
  asyncHandler(async (req, res) => {
    res.json({ assets: await listAssets(req.tenant!.organizationId) });
  }),
);

router.post(
  '/tenant/media',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as { filename?: string; contentType?: string; data?: string };
    if (!body.data || typeof body.data !== 'string') {
      throw new ValidationError('Field "data" (base64) is required');
    }
    const buffer = decodeBase64(body.data);
    if (buffer.length === 0) throw new ValidationError('Could not decode the image.');
    if (buffer.length > MAX_BYTES) throw new ValidationError('Image too large (max 10MB).');
    const asset = await uploadAndAnalyze({
      orgId,
      buffer,
      filename: typeof body.filename === 'string' ? body.filename : undefined,
      contentType: typeof body.contentType === 'string' ? body.contentType : undefined,
    });
    res.status(201).json({ asset });
  }),
);

router.post(
  '/tenant/media/director',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    res.json({ verdict: await directorVerdict(req.tenant!.organizationId) });
  }),
);

router.post(
  '/tenant/media/:id/enhance',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as { upscale?: boolean; brandGrade?: boolean; intensity?: number };
    const asset = await enhanceAsset(orgId, req.params.id, {
      upscale: body.upscale === true,
      brandGrade: body.brandGrade === true,
      intensity: typeof body.intensity === 'number' ? body.intensity : undefined,
    });
    res.json({ asset });
  }),
);

router.post(
  '/tenant/media/:id/reframe',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const aspects = Array.isArray(req.body?.aspects)
      ? (req.body.aspects as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
    const asset = await reframeAsset(orgId, req.params.id, aspects);
    res.json({ asset });
  }),
);

router.post(
  '/tenant/media/:id/backgrounds',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const styles = Array.isArray(req.body?.styles)
      ? (req.body.styles as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined;
    const asset = await backgroundAsset(orgId, req.params.id, styles);
    res.json({ asset });
  }),
);

router.delete(
  '/tenant/media/:id',
  asyncHandler(async (req, res) => {
    await deleteAsset(req.tenant!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
