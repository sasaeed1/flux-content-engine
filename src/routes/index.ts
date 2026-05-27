/** Route aggregation. */
import { Router } from 'express';
import health from './health.routes';
import tenant from './tenant.routes';
import pipeline from './pipeline.routes';
import ops from './ops.routes';
import webhooks from './webhooks.routes';
import sso from './sso.routes';

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
api.use(ops);
router.use('/api', api);

// Webhooks (self-authenticated via ?token=)
router.use('/api/webhooks', webhooks);

export default router;
