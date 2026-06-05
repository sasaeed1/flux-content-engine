/**
 * Settings routes — org-scoped system settings (generation/motion/seo/
 * notifications), persisted in organizations.metadata.settings.
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { NotFoundError, ValidationError } from '../lib/errors';
import { getOrgById } from '../db/repositories';
import { supabase } from '../lib/supabase';
import { loadSettings, mergeSettings } from '../modules/settings/settings';

const router = Router();
router.use(requireTenant);

router.get(
  '/tenant/settings',
  asyncHandler(async (req, res) => {
    const org = await getOrgById(req.tenant!.organizationId);
    if (!org) throw new NotFoundError('Organization not found');
    res.json({ settings: loadSettings(org.metadata) });
  }),
);

router.patch(
  '/tenant/settings',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const org = await getOrgById(orgId);
    if (!org) throw new NotFoundError('Organization not found');

    const next = mergeSettings(loadSettings(org.metadata), req.body ?? {});
    const metadata = {
      ...((org.metadata as Record<string, unknown>) ?? {}),
      settings: next,
    };
    const { error } = await supabase.from('organizations').update({ metadata }).eq('id', orgId);
    if (error) throw new ValidationError(error.message);
    res.json({ ok: true, settings: next });
  }),
);

export default router;
