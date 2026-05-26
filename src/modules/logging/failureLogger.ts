/**
 * Failure logger — persists recoverable failures to `failed_jobs`.
 * Never throws; a logging failure must not crash a pipeline run.
 */
import { insertFailedJob, type FailedJobInput } from '../../db/repositories';
import { toErrorMessage } from '../../lib/errors';
import { logger } from '../../lib/logger';

const RETRY_BACKOFF_MINUTES = [5, 20, 60, 180];

export function nextRetryAt(retryCount: number): string {
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(retryCount, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function logFailure(input: FailedJobInput): Promise<void> {
  try {
    const job = await insertFailedJob({
      ...input,
      next_retry_at: input.next_retry_at ?? nextRetryAt(0),
    });
    logger.error(
      {
        failedJobId: job.id,
        orgId: input.organization_id,
        jobType: input.job_type,
        step: input.step,
        error: input.error,
      },
      'Failure recorded',
    );
  } catch (err) {
    logger.error(
      { error: toErrorMessage(err), original: input.error },
      'CRITICAL: could not persist failed_job',
    );
  }
}
