/**
 * Internal scheduler — always-on operational jobs.
 *
 *   - publish-queue : drain due publish_queue jobs every PUBLISH_QUEUE_CRON.
 *   - retry-worker  : retry recoverable pipeline failures.
 *   - analytics     : refresh insights for recently published posts.
 *
 * n8n owns the daily creative trigger by default. To run it here too, set
 * ENABLE_DAILY_PIPELINE_CRON=true (intended for self-host single-tenant
 * deployments where n8n is not the orchestrator).
 */
import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { processPublishQueue } from '../queue/publishWorker';
import { processFailedJobs } from '../queue/retryWorker';
import { collectRecentAnalytics } from '../modules/analytics/analyticsService';
import { toErrorMessage } from '../lib/errors';
import { childLogger } from '../lib/logger';

const log = childLogger({ module: 'scheduler' });
const tasks: ScheduledTask[] = [];

function register(name: string, expression: string, job: () => Promise<unknown>): void {
  if (!cron.validate(expression)) {
    log.error({ name, expression }, 'Invalid cron expression — job not registered');
    return;
  }
  const task = cron.schedule(
    expression,
    async () => {
      const started = Date.now();
      try {
        const result = await job();
        log.info({ job: name, ms: Date.now() - started, result }, 'Scheduled job finished');
      } catch (err) {
        log.error({ job: name, error: toErrorMessage(err) }, 'Scheduled job failed');
      }
    },
    { timezone: env.TZ },
  );
  tasks.push(task);
  log.info({ job: name, expression }, 'Scheduled job registered');
}

export function startScheduler(): void {
  if (!env.ENABLE_INTERNAL_SCHEDULER) {
    log.info('Internal scheduler disabled (ENABLE_INTERNAL_SCHEDULER=false)');
    return;
  }

  if (env.ENABLE_DAILY_PIPELINE_CRON) {
    // Note: a "daily run" in multi-tenant mode requires iterating
    // active organizations. Wire this up when adding the multi-org
    // daily orchestration job (or let n8n do it per-org via webhook).
    log.warn('ENABLE_DAILY_PIPELINE_CRON=true is a placeholder in multi-tenant mode');
  } else {
    log.info('Daily pipeline cron is OFF — n8n is expected to trigger per-org pipelines');
  }

  register('publish-queue', env.PUBLISH_QUEUE_CRON, () => processPublishQueue(10));
  register('retry-worker', env.RETRY_CRON, () => processFailedJobs(5));
  register('analytics', env.ANALYTICS_CRON, () => collectRecentAnalytics(96));

  log.info({ jobs: tasks.length }, 'Internal scheduler started');
}

export function stopScheduler(): void {
  for (const task of tasks) task.stop();
  tasks.length = 0;
  log.info('Internal scheduler stopped');
}
