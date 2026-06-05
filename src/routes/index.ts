/** Route aggregation. */
import { Router } from 'express';
import health from './health.routes';
import tenant from './tenant.routes';
import pipeline from './pipeline.routes';
import edit from './edit.routes';
import ops from './ops.routes';
import webhooks from './webhooks.routes';
import sso from './sso.routes';
import intelligence from './intelligence.routes';
import reels from './reels.routes';
import settings from './settings.routes';
import social from './social.routes';

const router = Router();

// Public
router.use(health);

// SSO bridge (self-authenticated via signed JWT in body, no api key required).
// Mounted under /api but BEFORE the api router so /api/sso/exchange resolves
// without the requireTenant middleware.
router.use('/api', sso);

// Authenticated API surface — tenants use `x-org-api-key`, ops uses `x-api-key`
const api = Router();
api.use(tenant);
api.use(pipeline);
api.use(edit);
api.use(intelligence);
api.use(reels);
api.use(settings);
api.use(social);
api.use(ops);
router.use('/api', api);

// Webhooks (self-authenticated via ?token=)
router.use('/api/webhooks', webhooks);

export default router;
