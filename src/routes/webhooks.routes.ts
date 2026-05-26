/**
 * Webhook routes — inbound callbacks.
 *
 *   POST /api/webhooks/wappflow?token=...   — events from the WappFlow CRM
 *                                              (e.g. lead captured, DM reply)
 *   POST /api/webhooks/instagram?token=...  — IG webhooks (comments, DMs)
 *
 * Both are authenticated via a `?token=` query param (callers cannot set
 * arbitrary headers from third-party platforms). Use the INTERNAL_API_KEY
 * for now; rotate per-source secrets when wiring real production.
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware';
import { env } from '../config/env';
import { insertWebhookEvent, markWebhookProcessed } from '../db/repositories';
import { logger } from '../lib/logger';

const router = Router();

function requireToken(req: { query: { token?: unknown } }, expected: string): boolean {
  return typeof req.query.token === 'string' && req.query.token === expected;
}

router.post(
  '/wappflow',
  asyncHandler(async (req, res) => {
    if (!requireToken(req, env.INTERNAL_API_KEY)) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const event = await insertWebhookEvent({
      organization_id: typeof body.organizationId === 'string' ? body.organizationId : null,
      source: 'wappflow',
      event_type: typeof body.event === 'string' ? body.event : 'unknown',
      payload: body,
    });
    logger.info({ eventId: event.id, type: event.event_type }, 'WappFlow webhook accepted');
    // Mark processed immediately — actual handling can be added by a worker.
    await markWebhookProcessed(event.id);
    res.json({ ok: true, eventId: event.id });
  }),
);

router.post(
  '/instagram',
  asyncHandler(async (req, res) => {
    if (!requireToken(req, env.INTERNAL_API_KEY)) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const event = await insertWebhookEvent({
      source: 'instagram',
      event_type: typeof body.object === 'string' ? body.object : 'unknown',
      payload: body,
    });
    logger.info({ eventId: event.id, type: event.event_type }, 'Instagram webhook accepted');
    res.json({ ok: true, eventId: event.id });
  }),
);

// Optional GET for Meta's webhook subscription verification handshake.
router.get('/instagram', (req, res) => {
  const challenge = req.query['hub.challenge'];
  const verify = req.query['hub.verify_token'];
  if (verify === env.INTERNAL_API_KEY && typeof challenge === 'string') {
    res.send(challenge);
    return;
  }
  res.status(403).send('forbidden');
});

export default router;
