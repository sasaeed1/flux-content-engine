/**
 * SSO bridge — accepts a signed token from WappFlow (or any partner app)
 * and returns the Flux organization API key + a session cookie payload.
 *
 *   POST /api/sso/exchange  body: { token: <JWT> }
 *
 *   - Verifies HS256 signature against FLUX_SSO_SECRET (shared with issuer).
 *   - Looks up an existing Flux org by `metadata.external_workspace_id`.
 *   - Auto-provisions one if missing — tier is mirrored from the issuer.
 *
 * The response includes the Flux org API key so the caller (Flux web) can
 * scope subsequent requests. The caller is responsible for setting an
 * httpOnly cookie — we don't set one here because this endpoint is called
 * server-to-server from the Flux web app.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler } from '../middleware';
import { ValidationError, AppError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { verifySsoToken } from '../lib/sso';
import { childLogger } from '../lib/logger';

const router = Router();
const log = childLogger({ module: 'sso' });

function genApiKey(): string {
  return `org_${crypto.randomBytes(16).toString('hex')}`;
}

router.post(
  '/sso/exchange',
  asyncHandler(async (req, res) => {
    const token = req.body?.token;
    if (!token || typeof token !== 'string') {
      throw new ValidationError('Field "token" is required');
    }

    const payload = verifySsoToken(token);

    // Translate the issuer's plan name to Flux's internal tier enum.
    // The DB only knows: free / starter / pro / business.
    // WappFlow's marketing tiers (growth/enterprise) map onto pro/business.
    const sourcePlan = (payload.plan ?? 'free').toLowerCase();
    const tierMap: Record<string, string> = {
      free: 'free',
      starter: 'starter',
      growth: 'pro',
      pro: 'pro',
      enterprise: 'business',
      business: 'business',
    };
    const fluxTier = tierMap[sourcePlan] ?? 'free';
    const includedInFlux = new Set(['pro', 'business']);
    if (!includedInFlux.has(fluxTier)) {
      log.info({ sourcePlan, fluxTier }, 'SSO from lower tier — provisioning free tier');
    }

    // Look up existing Flux org by external workspace ID.
    const wfId = payload.wf_workspace_id;

    const existingRes = await supabase
      .from('organizations')
      .select('*')
      .contains('metadata', { external_workspace_id: wfId })
      .maybeSingle();

    if (existingRes.error && existingRes.error.code !== 'PGRST116') {
      throw new AppError(
        `SSO lookup failed: ${existingRes.error.message}`,
        { status: 500, code: 'SSO_LOOKUP_FAILED' },
      );
    }

    let org = existingRes.data;

    if (!org) {
      // Auto-provision. Name + slug fallback to workspace ID.
      const slug = `wf-${wfId.slice(0, 8)}`;
      const insertRes = await supabase
        .from('organizations')
        .insert({
          name: payload.name ?? `WappFlow workspace ${wfId.slice(0, 8)}`,
          slug,
          api_key: genApiKey(),
          subscription_tier: fluxTier,
          ai_provider: 'groq',
          active: true,
          metadata: {
            external_workspace_id: wfId,
            external_source: payload.iss,
            external_owner_email: payload.email ?? null,
            external_owner_name: payload.name ?? null,
            external_plan: sourcePlan,
            provisioned_via: 'sso',
          },
        })
        .select('*')
        .single();
      if (insertRes.error) {
        throw new AppError(
          `SSO provision failed: ${insertRes.error.message}`,
          { status: 500, code: 'SSO_PROVISION_FAILED' },
        );
      }
      org = insertRes.data;
      log.info({ orgId: org.id, wfId, tier: fluxTier }, 'Auto-provisioned Flux org via SSO');
    } else if (org.subscription_tier !== fluxTier) {
      // Sync tier on every SSO so WappFlow upgrades flow through immediately.
      const { error } = await supabase
        .from('organizations')
        .update({ subscription_tier: fluxTier })
        .eq('id', org.id);
      if (!error) org.subscription_tier = fluxTier;
    }

    res.json({
      ok: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscription_tier: org.subscription_tier,
        api_key: org.api_key,
      },
      user: {
        email: payload.email ?? null,
        name: payload.name ?? null,
        wf_user_id: payload.wf_user_id,
      },
    });
  }),
);

export default router;
