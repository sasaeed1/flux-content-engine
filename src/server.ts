/** Express application factory. */
import express, { type Express } from 'express';
import routes from './routes';
import { errorHandler, notFound } from './middleware';
import { logger } from './lib/logger';

export function createServer(): Express {
  const app = express();

  app.disable('x-powered-by');
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
