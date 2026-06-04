/** Express application factory. */
import express, { type Express } from 'express';
import routes from './routes';
import { errorHandler, notFound } from './middleware';
import { ipRateLimit } from './lib/rateLimit';
import { logger } from './lib/logger';

export function createServer(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy (Caddy/nginx) — trust the first hop for req.ip.
  app.set('trust proxy', 1);

  // Minimal security headers.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // Coarse per-IP rate limit (DoS safety net) before body parsing.
  app.use(ipRateLimit);

  // 16mb covers base64-encoded brand kit assets (raw 10mb cap + ~33% overhead).
  app.use(express.json({ limit: '16mb' }));

  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, 'Incoming request');
    next();
  });

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
