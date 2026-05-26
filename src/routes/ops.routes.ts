/**
 * Operational routes — INTERNAL_API_KEY only.
 * Designed for n8n / cron / WappFlow back-channel to trigger workers.
 */
import { Router } from 'express';
import { asyncHandler, requireInternal } from '../middleware';
import { processPublishQueue } from '../queue/publishWorker';
import { processFailedJobs } from '../queue/retryWorker';
import { collectRecentAnalytics } from '../modules/analytics/analyticsService';

const router = Router();
router.use(requireInternal);

router.post(
  '/ops/queue/process-publish',
  asyncHandler(async (req, res) => {
    const limit = Number(req.body?.limit) || 10;
    res.json(await processPublishQueue(limit));
  }),
);

router.post(
  '/ops/queue/process-retries',
  asyncHandler(async (req, res) => {
    const limit = Number(req.body?.limit) || 5;
    res.json(await processFailedJobs(limit));
  }),
);

router.post(
  '/ops/analytics/collect',
  asyncHandler(async (req, res) => {
    const sinceHours = Number(req.body?.sinceHours) || 96;
    res.json(await collectRecentAnalytics(sinceHours));
  }),
);

export default router;
