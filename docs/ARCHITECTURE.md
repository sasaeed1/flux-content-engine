# Architecture

## 1. Design principles

| Principle                | How it shows up                                                 |
| ------------------------ | --------------------------------------------------------------- |
| **Multi-tenant by default** | Every business row has `organization_id`; queries are scoped. |
| **Two planes**           | n8n orchestrates + alerts; this service executes.               |
| **Stateful + durable**   | Every step writes to Postgres; crashes never lose progress.     |
| **Fail-soft**            | 3-layer retries — in-call, publish queue, failed-job worker.    |
| **Self-host-friendly**   | Every paid API has a "none" or local alternative path.          |
| **Cost-first**           | Image gen off by default; templates render with brand colour.   |
| **Stateless service**    | All state in Supabase → horizontal scale is trivial.            |

## 2. The two planes

- **Orchestration plane — n8n**
  Schedules per-tenant runs, branches on success/failure, attaches alerts.
  Calls the HTTP API and stays thin so non-developers can adjust scheduling.
- **Execution plane — this service**
  Multi-tenant TypeScript pipeline + workers + renderer + publisher.

## 3. Tenancy model

- `organizations` is the tenant root. Each has `api_key`, optional
  `ai_provider`/`ai_provider_key` overrides, `subscription_tier`, and
  `credits_balance` / `monthly_credits_used` for billing.
- Every business table has `organization_id` (FK + index).
- Tenant API key (`x-org-api-key`) auth resolves the org in middleware and
  stores it on `req.tenant`. Routes never read other orgs' data.
- The service uses the **Supabase service-role key** and bypasses RLS. If you
  later expose tables to the anon key, enable RLS and add policies that join
  `org_memberships` to `auth.uid()`.
- Storage paths are tenant-prefixed: `orgs/{orgId}/runs/{runId}/slides/{i}.png`.

## 4. Modules

| Module        | Path                                          | Responsibility                                  |
| ------------- | --------------------------------------------- | ----------------------------------------------- |
| Scheduler     | `scheduler/scheduler.ts`                      | publish queue, retry, analytics crons           |
| Tenant auth   | `middleware.ts`                               | resolve org by `x-org-api-key`                  |
| Brand         | `modules/brand`                               | brand profile + theme preset merge              |
| Templates     | `modules/templates`                           | load org/system templates by key                |
| Topics        | `modules/topics`                              | lifecycle + AI topic generation                 |
| Content       | `modules/content`                             | carousel + single + caption + hashtags          |
| Images        | `modules/images`                              | multi-provider AI image gen                     |
| Render        | `modules/render`                              | composer + Puppeteer + HTML templates           |
| Publish       | `modules/publish`                             | IG Graph API carousel + single                  |
| Analytics     | `modules/analytics`                           | seed + refresh insights                         |
| Failure log   | `modules/logging/failureLogger.ts`            | failed_jobs writer (idempotent)                 |
| Pipeline      | `pipeline/pipeline.ts`                        | orchestrates everything                         |
| Queue workers | `queue/{publishWorker,retryWorker}.ts`        | publish + retry loops                           |

## 5. Data model (18 tables)

```
organizations ─┬─ org_memberships ── users
               ├─ brand_profiles ── theme_presets (global)
               ├─ templates (org-custom + system)
               ├─ instagram_accounts
               ├─ content_calendars ── content_topics
               ├─ pipeline_runs ──┬─ generated_carousels
               │                  ├─ generated_posts
               │                  └─ generated_assets (per slide)
               ├─ publish_queue ── published_posts ── analytics
               ├─ failed_jobs
               ├─ usage_logs
               └─ webhook_events
```

Conventions:
- UUID PKs, `created_at`/`updated_at` timestamps, `set_updated_at()` triggers.
- Status columns with `CHECK` constraints (CHECK constraints over enum types
  keep the schema evolvable without migrations on the type itself).
- `metadata`/`snapshot` JSONB everywhere — extensibility without migrations.
- Composite indexes on `(organization_id, status, scheduled_*)` patterns.
- `theme_presets` are global (no `organization_id`); `templates` are global if
  `organization_id IS NULL`, else org-scoped. Partial unique indexes enforce
  uniqueness within each scope.
- `v_org_overview` view rolls up counters for a per-org dashboard.

## 6. Pipeline flow

```
runPipeline({ organizationId, topicId?, postType?, approvalMode? })

  1. createRun                                        -> pipeline_runs
  2. resolveTopic (next pending or by id)             -> content_topics  (status=processing)
  3. loadBrandProfile + loadTemplate
  4. generateCarouselContent / generateSinglePostContent  (LLM)
  5. insertCarousel / insertPost  (status=ready)
  6. (skipped if IMAGE_PROVIDER=none) generate AI images
  7. composeSlides  (HTML -> Puppeteer -> Sharp -> Supabase upload)
  8. insertAsset per slide; updateCarousel/Post with public URLs
  9. if approvalMode=manual    -> status=pending_approval (stop)
     if approvalMode=auto      -> enqueuePublish + markTopicGenerated('auto')
 10. updateRun(status=completed)

   any failure -> updateRun(failed) + markTopicFailed + logFailure
```

## 7. Retry & error-handling — 3 layers

### Layer 1 — In-call retries (`lib/retry.ts`)
`withRetry()` wraps every external API call. Exponential backoff + jitter,
honours `Retry-After`, only retries transient failures (network, 408/409/425/
429, 5xx). Catches momentary blips invisibly.

### Layer 2 — Publish queue (`publish_queue` + `queue/publishWorker.ts`)
The queue IS the publish retry mechanism. Failed attempts go back to `pending`
with bumped `scheduled_for` (5m → 20m → 1h → 3h) + `retry_count`. After
`max_retries` the row becomes `failed` and a terminal `failed_jobs` row is
written for alerting. Jobs are claimed atomically (conditional update where
`status='pending'`) so concurrent workers never double-publish.

### Layer 3 — Failed-job recovery (`failed_jobs` + `queue/retryWorker.ts`)
Pipeline-level failures are recorded. The retry worker re-runs `runPipeline`
for the same topic with `suppressFailureLog=true` (so it doesn't duplicate the
record). Backoff escalates; after `max_retries` the row stays unresolved as
an alert.

### Idempotency guarantee
The publish worker treats **everything after a successful Graph API publish**
as best-effort bookkeeping — a DB hiccup post-publish never causes a re-post.

## 8. Cost optimisation

| Lever                       | Default       | Effect                                                        |
| --------------------------- | ------------- | ------------------------------------------------------------- |
| `IMAGE_PROVIDER=none`       | yes           | Slides rendered from typography + brand colours — $0/image.   |
| `AI_PROVIDER=groq`          | yes           | Free tier LLM; OpenAI-compatible — swap providers in one env. |
| Single carousel content call| —             | Hook + slides + CTA + caption + hashtags in one LLM round.    |
| Puppeteer reuse             | yes           | One browser process across slides; one `page` per slide.      |
| Per-tenant API keys         | optional      | Customers can bring their own keys — your bill stays flat.    |

## 9. Self-hosted AI roadmap

- **LLM**: `AI_PROVIDER=ollama` with a local model (e.g. `qwen2.5:7b`) —
  fully free, JSON mode supported via Ollama's `format: 'json'`.
- **Image gen**: `IMAGE_PROVIDER=comfyui` with a self-hosted ComfyUI server +
  Flux workflow → zero per-image cost.
- **Rendering**: already self-hosted (Puppeteer + Sharp).
- **Goal**: a customer on a single VPS can run the whole stack with no
  per-call external API charges beyond Instagram.

## 10. Scaling path

| Stage                       | Change                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| 1 → 10 carousels / org / day | Nothing — already supported.                                          |
| Multi-tenant production     | Run N stateless replicas — atomic queue claim makes it safe.          |
| Heavy queue volume          | Swap the DB queue for Redis + BullMQ (priorities, concurrency limits).|
| Heavy render volume         | Worker container with multiple Chrome processes; or Browserless.io.   |
| Image gen at scale          | ComfyUI cluster behind an HTTP load balancer.                          |
| LLM scale + privacy         | Self-host Ollama / vLLM; pin Groq for burst.                          |
| Per-tenant fairness         | Per-org BullMQ queue or rate limiter on the worker.                    |
