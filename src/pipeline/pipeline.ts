/**
 * Pipeline Orchestrator — produces one carousel or single post end-to-end.
 *
 *   topic -> content (LLM) -> render (HTML->PNG) -> upload -> enqueue publish
 *
 * Publishing itself is NOT done here — it is enqueued into `publish_queue`
 * and executed by the publish worker (durable retries, scheduling, future
 * approval gates).
 *
 * Tenancy: every step is scoped by organizationId; the pipeline never reads
 * or writes outside the tenant.
 */
import { childLogger } from '../lib/logger';
import { AppError, errorCode, toErrorMessage } from '../lib/errors';
import {
  createRun,
  enqueuePublish,
  getOrgById,
  insertAsset,
  insertCarousel,
  insertPost,
  updateCarousel,
  updatePost,
  updateRun,
} from '../db/repositories';
import {
  markTopicFailed,
  markTopicGenerated,
  markTopicProcessing,
  resolveTopic,
} from '../modules/topics/topicService';
import { loadBrandProfile } from '../modules/brand/brandService';
import {
  defaultTemplateKeyForType,
  loadTemplate,
} from '../modules/templates/templateService';
import { generateCarouselContent } from '../modules/content/carouselContentService';
import { generateSinglePostContent } from '../modules/content/singlePostContentService';
import { composeSlides } from '../modules/render/composer';
import { resolveInstagramAccount } from '../modules/publish/accountService';
import { logFailure } from '../modules/logging/failureLogger';
import { PIPELINE_STEPS, type PipelineStep } from '../config/constants';
import type {
  CarouselContent,
  ContentTopicRow,
  PipelineOptions,
  PipelineResult,
  PostType,
  RenderedSlide,
  SinglePostContent,
  SlideContent,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function buildFinalCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .slice(0, 30)
    .map((h) => `#${h.replace(/[^a-zA-Z0-9_]/g, '')}`)
    .filter((t) => t.length > 1)
    .join(' ');
  const full = `${caption.trim()}\n\n${tags}`.trim();
  return full.length > 2200 ? full.slice(0, 2200) : full;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const log = childLogger({ orgId: options.organizationId });

  const org = await getOrgById(options.organizationId);
  if (!org) {
    return {
      runId: '',
      status: 'failed',
      organizationId: options.organizationId,
      error: `Organization ${options.organizationId} not found`,
    };
  }

  const run = await createRun({
    organization_id: org.id,
    metadata: {
      trigger: options.topicId ? 'manual' : 'scheduled',
      approvalMode: options.approvalMode,
    },
  });

  let topic: ContentTopicRow | undefined;
  let carouselId: string | undefined;
  let postId: string | undefined;
  const stepsCompleted: string[] = [];
  let currentStep = 'topic' as PipelineStep;

  const step = async <T>(name: PipelineStep, fn: () => Promise<T>): Promise<T> => {
    currentStep = name;
    await updateRun(run.id, { current_step: name });
    log.info({ step: name }, 'Step started');
    const result = await fn();
    stepsCompleted.push(name);
    await updateRun(run.id, { steps_completed: stepsCompleted });
    return result;
  };

  try {
    /* ---------- topic ---------- */
    topic = await step('topic', () => resolveTopic(org.id, options.topicId));
    await updateRun(run.id, { topic_id: topic.id });
    await markTopicProcessing(topic);

    const postType: PostType = (options.postType ?? topic.post_type) as PostType;
    const isCarousel = postType === 'carousel' || postType === 'educational';
    const templateKey =
      options.templateKey ?? defaultTemplateKeyForType(postType);

    await updateRun(run.id, { type: isCarousel ? 'carousel' : 'single' });

    /* ---------- brand + template ---------- */
    const brand = await loadBrandProfile(org.id, options.brandProfileId ?? null);
    const template = await loadTemplate(org.id, templateKey);

    /* ---------- content ---------- */
    let carouselContent: CarouselContent | null = null;
    let singleContent: SinglePostContent | null = null;
    let slides: SlideContent[];

    if (isCarousel) {
      carouselContent = await step('content', () =>
        generateCarouselContent({
          organization: org,
          brand,
          template,
          topic: topic!.topic,
          angle: topic!.angle,
        }),
      );
      slides = carouselContent.slides;
    } else {
      singleContent = await step('content', () =>
        generateSinglePostContent({
          organization: org,
          brand,
          template,
          topic: topic!.topic,
          angle: topic!.angle,
        }),
      );
      slides = [
        {
          index: 0,
          role: postType === 'quote' ? 'quote' : 'cta',
          layout: singleContent.layout,
          data: singleContent.data,
        },
      ];
    }

    /* ---------- persist draft (status='ready') ---------- */
    if (isCarousel && carouselContent) {
      const row = await insertCarousel({
        organization_id: org.id,
        topic_id: topic.id,
        run_id: run.id,
        brand_profile_id: brand.id,
        template_id: template.id,
        title: carouselContent.title,
        hook: carouselContent.hook,
        caption: carouselContent.caption,
        hashtags: carouselContent.hashtags,
        cta: carouselContent.cta,
        slides: carouselContent.slides as unknown as Record<string, unknown>,
        slide_count: carouselContent.slides.length,
        status: 'ready',
      });
      carouselId = row.id;
    } else if (singleContent) {
      const row = await insertPost({
        organization_id: org.id,
        topic_id: topic.id,
        run_id: run.id,
        brand_profile_id: brand.id,
        template_id: template.id,
        caption: singleContent.caption,
        hashtags: singleContent.hashtags,
        status: 'ready',
      });
      postId = row.id;
    }

    /* ---------- render slides ---------- */
    // (image-gen step intentionally skipped on the IMAGE_PROVIDER=none path)
    await step('images', async () => 'skipped');

    const rendered: RenderedSlide[] = await step('render', () =>
      composeSlides({
        orgId: org.id,
        runId: run.id,
        brand,
        template,
        slides,
      }),
    );

    /* ---------- upload (already done by composer) + persist assets ---------- */
    await step('upload', async () => {
      for (const r of rendered) {
        await insertAsset({
          organization_id: org.id,
          run_id: run.id,
          carousel_id: carouselId ?? null,
          post_id: postId ?? null,
          slide_index: r.slideIndex,
          type: 'render',
          provider: 'puppeteer',
          storage_path: r.storagePath,
          public_url: r.publicUrl,
          width: r.width,
          height: r.height,
          bytes: r.bytes,
        });
      }
      // Persist the public URLs onto the carousel/post row.
      if (isCarousel && carouselId && carouselContent) {
        const slidesWithUrls = carouselContent.slides.map((s, i) => ({
          ...s,
          imageUrl: rendered[i]?.publicUrl,
          storagePath: rendered[i]?.storagePath,
        }));
        await updateCarousel(org.id, carouselId, {
          slides: slidesWithUrls as unknown as Record<string, unknown>,
        });
      } else if (postId) {
        await updatePost(org.id, postId, {
          image_storage_path: rendered[0]?.storagePath ?? null,
          image_url: rendered[0]?.publicUrl ?? null,
        });
      }
      return rendered.length;
    });

    /* ---------- approval gate (manual mode OR no IG account) ---------- */
    // If the caller asked for manual approval OR the org has no IG account
    // configured yet, we stop at "produced content" and let the user approve
    // from the dashboard. This way fresh workspaces don't see false failures.
    const approvalMode = options.approvalMode ?? 'auto';
    let account: Awaited<ReturnType<typeof resolveInstagramAccount>> | null = null;
    let igAccountMissing = false;
    if (approvalMode === 'auto') {
      try {
        account = await resolveInstagramAccount(org.id);
      } catch (e) {
        const msg = toErrorMessage(e);
        if (/no instagram account|instagram account configured/i.test(msg)) {
          igAccountMissing = true;
          log.warn({ orgId: org.id }, 'No IG account — falling back to manual approval');
        } else {
          throw e;
        }
      }
    }

    if (approvalMode === 'manual' || igAccountMissing) {
      await markTopicGenerated(topic, 'manual');
      await updateRun(run.id, {
        status: 'completed',
        current_step: 'enqueue',
        finished_at: nowIso(),
        metadata: {
          ...(run.metadata as object),
          approvalGated: true,
          ...(igAccountMissing ? { igAccountMissing: true } : {}),
        },
      });
      log.info({ topic: topic.topic }, 'Pipeline produced content — awaiting manual approval');
      return {
        runId: run.id,
        status: 'pending_approval',
        organizationId: org.id,
        topicId: topic.id,
        carouselId,
        postId,
        imageUrls: rendered.map((r) => r.publicUrl),
      };
    }

    /* ---------- enqueue publish ---------- */
    if (!account) {
      account = await resolveInstagramAccount(org.id);
    }
    const caption = buildFinalCaption(
      (carouselContent?.caption ?? singleContent?.caption ?? '') as string,
      (carouselContent?.hashtags ?? singleContent?.hashtags ?? []) as string[],
    );
    const publishAt = options.publishAt ?? nowIso();
    const mediaUrls = rendered.map((r) => r.publicUrl);

    const queued = await step('enqueue', () =>
      enqueuePublish({
        organization_id: org.id,
        topic_id: topic!.id,
        post_id: postId ?? null,
        carousel_id: carouselId ?? null,
        instagram_account_id: account.id,
        post_type: isCarousel ? 'carousel' : 'single',
        caption,
        hashtags: (carouselContent?.hashtags ?? singleContent?.hashtags ?? []) as string[],
        media_urls: mediaUrls,
        scheduled_for: publishAt,
      }),
    );

    await markTopicGenerated(topic, 'auto');
    await updateRun(run.id, {
      status: 'completed',
      current_step: 'enqueue',
      finished_at: nowIso(),
      steps_completed: stepsCompleted,
    });

    log.info({ topic: topic.topic, slides: mediaUrls.length }, 'Pipeline completed');
    return {
      runId: run.id,
      status: 'completed',
      organizationId: org.id,
      topicId: topic.id,
      carouselId,
      postId,
      publishQueueId: queued.id,
      imageUrls: mediaUrls,
    };
  } catch (err) {
    const message = toErrorMessage(err);
    const code = errorCode(err);
    log.error({ step: currentStep, error: message }, 'Pipeline failed');

    try {
      await updateRun(run.id, {
        status: 'failed',
        current_step: currentStep,
        error: message,
        finished_at: nowIso(),
      });
      if (topic) await markTopicFailed(topic);
      if (!options.suppressFailureLog) {
        await logFailure({
          organization_id: org.id,
          run_id: run.id,
          job_type: 'pipeline',
          step: currentStep,
          entity_table: 'content_topics',
          entity_id: topic?.id ?? null,
          error: message,
          error_code: code,
          payload: { topicId: topic?.id },
        });
      }
    } catch (cleanupErr) {
      log.error({ error: toErrorMessage(cleanupErr) }, 'Error during failure cleanup');
    }

    return {
      runId: run.id,
      status: 'failed',
      organizationId: org.id,
      topicId: topic?.id,
      error: message,
    };
  }
}

/** Exported for typing convenience. */
export type { PipelineStep };
export { PIPELINE_STEPS };
