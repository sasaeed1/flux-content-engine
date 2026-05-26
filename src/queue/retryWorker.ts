/**
 * Retry Worker — re-runs failed pipeline jobs.
 *
 * Multi-tenant: failed_jobs.organization_id is required for any pipeline
 * retry (we need to know which tenant to run). publish retries are owned
 * by publish_queue itself and are NOT processed here.
 */
import { getRetryableJobs, updateFailedJob } from '../db/repositories';
import { runPipeline } from '../pipeline/pipeline';
import { nextRetryAt } from '../modules/logging/failureLogger';
import { toErrorMessage } from '../lib/errors';
import { childLogger } from '../lib/logger';
import type { FailedJobRow } from '../types';

const log = childLogger({ module: 'retry-worker' });

export interface RetryWorkerResult {
  processed: number;
  resolved: number;
  requeued: number;
}

function topicIdOf(job: FailedJobRow): string | null {
  if (job.entity_table === 'content_topics' && job.entity_id) return job.entity_id;
  const fromPayload = (job.payload as { topicId?: unknown })?.topicId;
  return typeof fromPayload === 'string' ? fromPayload : null;
}

async function bump(job: FailedJobRow, error: string): Promise<void> {
  await updateFailedJob(job.id, {
    retry_count: job.retry_count + 1,
    error,
    next_retry_at: nextRetryAt(job.retry_count + 1),
  });
}

export async function processFailedJobs(limit = 5): Promise<RetryWorkerResult> {
  const jobs = await getRetryableJobs(limit);
  let resolved = 0;
  let requeued = 0;

  for (const job of jobs) {
    if (job.job_type !== 'pipeline') continue; // publish_queue owns its own retries
    if (!job.organization_id) {
      await updateFailedJob(job.id, { resolved: true, error: 'no organization_id' });
      continue;
    }
    const topicId = topicIdOf(job);
    if (!topicId) {
      await updateFailedJob(job.id, { resolved: true, error: 'no topic id to retry' });
      continue;
    }

    try {
      log.info(
        { failedJobId: job.id, orgId: job.organization_id, topicId, attempt: job.retry_count + 1 },
        'Retrying pipeline',
      );
      const result = await runPipeline({
        organizationId: job.organization_id,
        topicId,
        suppressFailureLog: true,
      });
      if (result.status === 'completed' || result.status === 'pending_approval') {
        await updateFailedJob(job.id, { resolved: true });
        resolved += 1;
      } else {
        await bump(job, result.error ?? 'retry did not complete');
        requeued += 1;
      }
    } catch (err) {
      await bump(job, toErrorMessage(err));
      requeued += 1;
    }
  }
  return { processed: jobs.length, resolved, requeued };
}
