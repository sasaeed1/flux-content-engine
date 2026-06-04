/**
 * Pipeline routes — tenant-scoped.
 *
 *   POST /tenant/pipeline/run         - run the content pipeline (synchronous)
 *   GET  /tenant/pipeline/runs/:id    - inspect a run
 *   POST /tenant/carousels/:id/approve - approve + enqueue a queued carousel
 *   POST /tenant/posts/:id/approve     - approve + enqueue a queued single post
 */
import { Router } from 'express';
import { asyncHandler, requireTenant } from '../middleware';
import { generationRateLimit } from '../lib/rateLimit';
import { NotFoundError, ValidationError } from '../lib/errors';
import { runPipeline } from '../pipeline/pipeline';
import { supabase } from '../lib/supabase';
import {
  enqueuePublish,
  getCarouselByIdScoped,
  getRun,
  listCarouselsForOrg,
  listPipelineRunsForOrg,
  updateCarousel,
  updatePost,
} from '../db/repositories';
import { resolveInstagramAccount } from '../modules/publish/accountService';
import type { PipelineOptions, PostType } from '../types';

const router = Router();
router.use(requireTenant);

function buildPipelineOptions(orgId: string, body: Record<string, unknown>): PipelineOptions {
  return {
    organizationId: orgId,
    topicId: typeof body.topicId === 'string' ? body.topicId : undefined,
    brandProfileId: typeof body.brandProfileId === 'string' ? body.brandProfileId : undefined,
    templateKey: typeof body.templateKey === 'string' ? body.templateKey : undefined,
    postType: typeof body.postType === 'string' ? (body.postType as PostType) : undefined,
    publishAt: typeof body.publishAt === 'string' ? body.publishAt : undefined,
    approvalMode: body.approvalMode === 'manual' ? 'manual' : 'auto',
    styleModeKey:
      typeof body.styleModeKey === 'string' && body.styleModeKey.length > 0
        ? body.styleModeKey
        : undefined,
    draftOnly: body.draftOnly === true,
    slideCount:
      Number.isFinite(Number(body.slideCount)) && Number(body.slideCount) > 0
        ? Math.round(Number(body.slideCount))
        : undefined,
  };
}

/** POST /tenant/pipeline/run — synchronous; check `body.status` to branch. */
router.post(
  '/tenant/pipeline/run',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await runPipeline(buildPipelineOptions(orgId, body));
    res.json(result);
  }),
);

/**
 * POST /tenant/pipeline/batch — Sprint H "forge the month" one-click.
 *
 * Picks up to `count` (cap 12) pending topics and produces a carousel for each,
 * in the BACKGROUND (responds immediately so the request never times out).
 * draftOnly defaults to true so a month of scripts materializes fast for the
 * user to review/edit; pass draftOnly:false to render fully. Budget-capped and
 * sequential (concurrency 1) to stay within free-tier quotas.
 */
router.post(
  '/tenant/pipeline/batch',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const count = Math.min(12, Math.max(1, Number(body.count) || 8));
    const draftOnly = body.draftOnly !== false; // default true
    const styleModeKey =
      typeof body.styleModeKey === 'string' && body.styleModeKey.length > 0
        ? body.styleModeKey
        : undefined;

    // Find pending topics to consume.
    const { data: pending, error } = await supabase
      .from('content_topics')
      .select('id')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('scheduled_date', { ascending: true })
      .order('priority', { ascending: false })
      .limit(count);
    if (error) throw new ValidationError(error.message);

    const topicIds = (pending ?? []).map((r) => r.id as string);
    if (topicIds.length === 0) {
      res.json({ ok: true, queued: 0, message: 'No pending topics — generate some first.' });
      return;
    }

    // Respond immediately; process sequentially in the background.
    res.json({ ok: true, queued: topicIds.length, draftOnly });

    void (async () => {
      for (const topicId of topicIds) {
        try {
          await runPipeline({
            organizationId: orgId,
            topicId,
            styleModeKey,
            approvalMode: 'manual',
            draftOnly,
            suppressFailureLog: false,
          });
        } catch {
          /* per-topic failure already logged by the pipeline; keep going */
        }
      }
    })();
  }),
);

/**
 * POST /tenant/pipeline/run-stream — Server-Sent Events.
 *
 * Holds the response open and writes one `event:` chunk per pipeline event
 * (started → topic_resolved → brand_loaded → content_generated → slide_rendered ×N
 *  → render_complete → enqueued/awaiting_approval → complete | error).
 *
 * Frontend consumes via fetch + ReadableStream (so the org API key stays in
 * the x-org-api-key header — EventSource can't set headers). The Studio uses
 * this to materialize slides as they land, dropping perceived latency from
 * ~30s (await everything) to ~2s (first slide).
 *
 * Connection-keepalive: a `:ping` comment line every 15s keeps proxies
 * (nginx, Cloudflare) from idling the socket during long content gen.
 */
router.post(
  '/tenant/pipeline/run-stream',
  generationRateLimit,
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const body = (req.body ?? {}) as Record<string, unknown>;

    // SSE headers. X-Accel-Buffering disables nginx response buffering so
    // chunks flush to the client immediately.
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const write = (chunk: string) => {
      if (closed) return;
      try {
        res.write(chunk);
      } catch {
        closed = true;
      }
    };

    // Heartbeat keeps the socket open through long synchronous waits
    // (e.g. provider hiccups). 15s is short enough for Cloudflare's 60s idle.
    const heartbeat = setInterval(() => write(`:ping ${Date.now()}\n\n`), 15_000);

    const sink = (event: import('../pipeline/events').PipelineEvent) => {
      if (closed) return;
      // SSE format: `event: <type>\ndata: <json>\n\n`. The leading `event:`
      // line is optional but lets EventSource consumers listen for specific
      // types — we keep it so a future EventSource-based client can plug in.
      const data = JSON.stringify(event);
      write(`event: ${event.type}\ndata: ${data}\n\n`);
    };

    try {
      const result = await runPipeline(buildPipelineOptions(orgId, body), sink);
      // Final summary line so the client can resolve its top-level promise
      // even if it missed the `complete` event mid-flight.
      write(`event: result\ndata: ${JSON.stringify(result)}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      write(`event: error\ndata: ${JSON.stringify({ type: 'error', payload: { message } })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      if (!closed) {
        write('event: done\ndata: {}\n\n');
        res.end();
      }
    }
  }),
);

router.get(
  '/tenant/pipeline/runs',
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const runs = await listPipelineRunsForOrg(req.tenant!.organizationId, limit);
    res.json({ runs });
  }),
);

router.get(
  '/tenant/pipeline/runs/:id',
  asyncHandler(async (req, res) => {
    const run = await getRun(req.params.id);
    if (!run || run.organization_id !== req.tenant!.organizationId) {
      throw new NotFoundError(`Run ${req.params.id} not found`);
    }
    res.json(run);
  }),
);

router.get(
  '/tenant/carousels',
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const carousels = await listCarouselsForOrg(req.tenant!.organizationId, { limit, status });
    res.json({ carousels });
  }),
);

router.get(
  '/tenant/carousels/:id',
  asyncHandler(async (req, res) => {
    const row = await getCarouselByIdScoped(req.tenant!.organizationId, req.params.id);
    if (!row) throw new NotFoundError(`Carousel ${req.params.id} not found`);
    res.json({ carousel: row });
  }),
);

/* ---------- approval gates (manual mode) ---------- */

async function loadCarouselScoped(orgId: string, id: string) {
  const { data, error } = await supabase
    .from('generated_carousels')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(`load carousel: ${error.message}`);
  return data as Record<string, unknown> | null;
}

async function loadPostScoped(orgId: string, id: string) {
  const { data, error } = await supabase
    .from('generated_posts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(`load post: ${error.message}`);
  return data as Record<string, unknown> | null;
}

router.post(
  '/tenant/carousels/:id/approve',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const row = await loadCarouselScoped(orgId, req.params.id);
    if (!row) throw new NotFoundError(`Carousel ${req.params.id} not found`);

    const slides = (row.slides as Array<{ imageUrl?: string }>) ?? [];
    const mediaUrls = slides.map((s) => s.imageUrl).filter(Boolean) as string[];
    if (mediaUrls.length < 2) {
      throw new ValidationError(
        `Carousel has only ${mediaUrls.length} rendered slides (need at least 2)`,
      );
    }
    const account = await resolveInstagramAccount(orgId);
    const queued = await enqueuePublish({
      organization_id: orgId,
      carousel_id: req.params.id,
      instagram_account_id: account.id,
      post_type: 'carousel',
      caption: String(row.caption ?? ''),
      hashtags: (row.hashtags as string[]) ?? [],
      media_urls: mediaUrls,
      scheduled_for:
        typeof req.body?.publishAt === 'string'
          ? (req.body.publishAt as string)
          : new Date().toISOString(),
    });
    await updateCarousel(orgId, req.params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
    res.json({ ok: true, publishQueueId: queued.id });
  }),
);

router.post(
  '/tenant/posts/:id/approve',
  asyncHandler(async (req, res) => {
    const orgId = req.tenant!.organizationId;
    const row = await loadPostScoped(orgId, req.params.id);
    if (!row) throw new NotFoundError(`Post ${req.params.id} not found`);
    const imageUrl = row.image_url as string | null;
    if (!imageUrl) throw new ValidationError('Post has no rendered image yet');
    const account = await resolveInstagramAccount(orgId);
    const queued = await enqueuePublish({
      organization_id: orgId,
      post_id: req.params.id,
      instagram_account_id: account.id,
      post_type: 'single',
      caption: String(row.caption ?? ''),
      hashtags: (row.hashtags as string[]) ?? [],
      media_urls: [imageUrl],
      scheduled_for:
        typeof req.body?.publishAt === 'string'
          ? (req.body.publishAt as string)
          : new Date().toISOString(),
    });
    await updatePost(orgId, req.params.id, {
      status: 'approved',
      approved_at: new Date().toISOString(),
    });
    res.json({ ok: true, publishQueueId: queued.id });
  }),
);

export default router;
