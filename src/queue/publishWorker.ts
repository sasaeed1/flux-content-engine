/**
 * Publish Worker — multi-tenant; drains `publish_queue`.
 *
 * The queue IS the publish retry mechanism: a failed attempt returns the
 * job to `pending` with a bumped `scheduled_for` + `retry_count`; after
 * `max_retries` it becomes `failed`. Jobs are claimed atomically.
 */
import { v4 as uuidv4 } from 'uuid';
import {
  claimPublishJob,
  getDuePublishJobs,
  insertPublishedPost,
  updatePublishJob,
} from '../db/repositories';
import { resolveInstagramAccount } from '../modules/publish/accountService';
import { publishCarousel, publishSingle } from '../modules/publish/instagramService';
import { seedAnalytics } from '../modules/analytics/analyticsService';
import { logFailure, nextRetryAt } from '../modules/logging/failureLogger';
import { errorCode, toErrorMessage } from '../lib/errors';
import { childLogger } from '../lib/logger';
import type { PublishQueueRow } from '../types';

const log = childLogger({ module: 'publish-worker' });

export interface PublishWorkerResult {
  processed: number;
  published: number;
  failed: number;
}

async function publishOne(job: PublishQueueRow): Promise<void> {
  const account = await resolveInstagramAccount(job.organization_id, job.instagram_account_id);

  const result =
    job.post_type === 'carousel'
      ? await publishCarousel({
          account,
          caption: job.caption ?? '',
          imageUrls: job.media_urls,
        })
      : await publishSingle({
          account,
          caption: job.caption ?? '',
          imageUrl: job.media_urls[0],
        });

  // From here the reel is LIVE. Bookkeeping must never throw.
  try {
    await updatePublishJob(job.id, {
      status: 'published',
      locked_at: null,
      locked_by: null,
    });
    const post = await insertPublishedPost({
      organization_id: job.organization_id,
      queue_id: job.id,
      post_id: job.post_id,
      carousel_id: job.carousel_id,
      instagram_account_id: job.instagram_account_id,
      ig_container_id: result.containerId,
      ig_media_id: result.mediaId,
      permalink: result.permalink ?? null,
      post_type: job.post_type,
      caption: job.caption,
      published_at: new Date().toISOString(),
    });
    await seedAnalytics({
      organizationId: job.organization_id,
      publishedPostId: post.id,
      igMediaId: result.mediaId,
    });
  } catch (err) {
    log.error(
      { jobId: job.id, mediaId: result.mediaId, error: toErrorMessage(err) },
      'Post published but bookkeeping failed — reconcile manually',
    );
  }
}

async function handleFailure(job: PublishQueueRow, err: unknown): Promise<void> {
  const message = toErrorMessage(err);
  const retryCount = job.retry_count + 1;
  const exhausted = retryCount >= job.max_retries;

  await updatePublishJob(job.id, {
    status: exhausted ? 'failed' : 'pending',
    retry_count: retryCount,
    last_error: message,
    locked_at: null,
    locked_by: null,
    scheduled_for: exhausted ? job.scheduled_for : nextRetryAt(retryCount),
  });

  if (exhausted) {
    await logFailure({
      organization_id: job.organization_id,
      job_type: 'publish',
      step: 'publish',
      entity_table: 'publish_queue',
      entity_id: job.id,
      error: message,
      error_code: errorCode(err),
      max_retries: 1,
      payload: { mediaUrls: job.media_urls, postType: job.post_type },
    });
  }
  log.warn({ jobId: job.id, retryCount, exhausted, error: message }, 'Publish attempt failed');
}

export async function processPublishQueue(limit = 10): Promise<PublishWorkerResult> {
  const workerId = `pub-${uuidv4().slice(0, 8)}`;
  const due = await getDuePublishJobs(limit);
  let published = 0;
  let failed = 0;

  for (const job of due) {
    const claimed = await claimPublishJob(job.id, workerId);
    if (!claimed) continue;
    try {
      await publishOne(claimed);
      published += 1;
    } catch (err) {
      await handleFailure(claimed, err);
      failed += 1;
    }
  }
  return { processed: due.length, published, failed };
}
