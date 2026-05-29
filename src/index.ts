/**
 * Application entrypoint — boots the HTTP API and the internal scheduler.
 */
import { env } from './config/env';
import { createServer } from './server';
import { startScheduler, stopScheduler } from './scheduler/scheduler';
import { ensureBuckets } from './lib/storage';
import { shutdownRenderer } from './modules/render/htmlRenderer';
import { seedSystemStyleModes } from './modules/styles/seedOnBoot';
import { logger } from './lib/logger';
import { toErrorMessage } from './lib/errors';

async function main(): Promise<void> {
  logger.info(
    { nodeEnv: env.NODE_ENV, aiProvider: env.AI_PROVIDER, imageProvider: env.IMAGE_PROVIDER },
    'Starting content-engine',
  );

  try {
    await ensureBuckets();
  } catch (err) {
    logger.error({ error: toErrorMessage(err) }, 'Storage bucket provisioning failed — continuing');
  }

  // Auto-seed the 40 system style modes if the phase1 migration has been
  // applied. Silently no-ops if the table doesn't exist yet.
  try {
    await seedSystemStyleModes();
  } catch (err) {
    logger.warn({ error: toErrorMessage(err) }, 'style-mode auto-seed failed — continuing');
  }

  const app = createServer();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'HTTP server listening');
  });

  startScheduler();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    stopScheduler();
    void shutdownRenderer();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: toErrorMessage(reason) }, 'Unhandled promise rejection');
  });
}

main().catch((err) => {
  logger.error({ error: toErrorMessage(err) }, 'Fatal startup error');
  process.exit(1);
});
