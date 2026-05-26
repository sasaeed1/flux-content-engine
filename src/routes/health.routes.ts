/** Health route — public (used by Docker healthcheck). */
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'content-engine',
    uptimeSec: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

export default router;
