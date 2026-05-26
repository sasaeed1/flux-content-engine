# Roadmap

This documents **what landed in the foundation session** vs. **what's next**,
mapped against the original 20-deliverable spec.

## Foundation — what's IN this codebase

| # | Deliverable                            | Status     | Where                                                |
|---|----------------------------------------|------------|------------------------------------------------------|
| 1 | Complete revised architecture          | ✅ done    | `docs/ARCHITECTURE.md`, this file                    |
| 2 | Updated folder structure               | ✅ done    | the repo                                             |
| 3 | Multi-tenant Supabase schema           | ✅ done    | `db/schema.sql` — 18 tables + view                   |
| 4 | Template engine architecture           | ✅ done    | `modules/templates` + `modules/render/templates`     |
| 5 | Carousel generation architecture       | ✅ done    | `modules/content/carouselContentService.ts`          |
| 6 | Brand consistency engine               | ✅ done    | `modules/brand` + `theme_presets` + CSS-var rendering|
| 7 | Open-source AI integration layer       | ◑ partial  | LLM: Groq/OpenAI/**Ollama** wired; image: stubs      |
| 8 | Instagram publishing flow              | ✅ done    | `modules/publish/instagramService.ts` (carousel + single) |
| 9 | WappFlow integration strategy          | ✅ done    | `docs/INTEGRATION.md` + webhook endpoints            |
|10 | SaaS dashboard structure               | ◑ partial  | API surface complete; frontend not built (Phase 2)   |
|11 | Queue/retry system                     | ✅ done    | `queue/`, 3-layer retries documented                 |
|12 | Scaling architecture                   | ✅ done    | `docs/ARCHITECTURE.md` §10                           |
|13 | Docker deployment                      | ✅ done    | `Dockerfile` + `docker-compose.yml`                  |
|14 | n8n workflow redesign                  | ✅ done    | `workflows/n8n-content-factory.json`                 |
|15 | AI prompt libraries                    | ✅ done    | `ai/prompts.ts` (6 prompt builders + schemas)        |
|16 | Content generation pipelines           | ✅ done    | `pipeline/pipeline.ts`                               |
|17 | Theme engine architecture              | ✅ done    | `theme_presets` (9 themes) + `modules/brand`         |
|18 | Image rendering pipeline               | ✅ done    | `modules/render` (Puppeteer + Sharp + HTML)          |
|19 | Self-hosted AI roadmap                 | ✅ design  | `docs/ARCHITECTURE.md` §9                            |
|20 | Future SaaS scaling strategy           | ✅ design  | `docs/ARCHITECTURE.md` §10                           |

## Phase 2 — Dashboard

A modern SaaS dashboard (Next.js + Supabase Auth) consuming the existing API:

- Pages: dashboard, content calendar, brand settings, theme picker, carousel
  preview/approval queue, Instagram accounts, automation settings, analytics.
- Approval queue powered by `generated_carousels.status = 'ready'`.
- Theme picker reads from `/api/tenant/themes` + previews the brand via a
  per-theme test render.
- Billing-ready: Stripe customer linked to `organizations.id`; the existing
  `usage_logs` + `monthly_credits_used` columns drive metering.

## Phase 3 — Self-hosted image generation

| Step | What                                                                       |
| ---- | -------------------------------------------------------------------------- |
| 3.1  | Implement `ComfyUI` provider — POST workflow JSON + poll `/history/{id}`.  |
| 3.2  | Implement `Fal` provider — `POST https://fal.run/fal-ai/flux/schnell`.     |
| 3.3  | Per-org image-provider override on `organizations` (mirror of `ai_provider`).|
| 3.4  | Composer: when an AI image is generated, layer template typography on top  |
|      | via the same HTML template (background-image: url(...)).                   |
| 3.5  | Image caching by prompt hash → avoid regenerating identical backgrounds.   |

## Phase 4 — Outbound + inbound automation

- **Outbound webhooks** to WappFlow on `post.published`, `post.failed`,
  `analytics.updated`. Signed with `WAPPFLOW_WEBHOOK_SECRET`.
- **Inbound IG DM worker** → forwards leads to WappFlow.
- **Token auto-refresh** for long-lived IG tokens (monthly cron).

## Phase 5 — Multi-tenant orchestration in n8n

Today the n8n workflow is per-tenant (one workflow per org). Phase 5:

- Add `GET /api/ops/orgs/active` returning active orgs + their `api_key`.
- A single n8n workflow loops over them and runs the pipeline per org.
- Per-org failure isolation: one bad org never blocks the others.

## Phase 6 — Trend mining

- New `modules/trends/` pulling signals (Google Trends, IG/TT scrapers, X).
- LLM scores + de-duplicates, inserts into `content_topics` with
  `source='trend'`.
- Scheduler job (nightly).

## Phase 7 — Performance-driven content

- A weekly job feeds top/bottom performers (from `analytics`) back into the
  content prompts as `RESULTS CONTEXT` so future prompts learn what works.
- Hook A/B: `buildHookVariantsPrompt` (already shipped) becomes part of the
  pipeline; two variants render; n8n promotes the winner by 24-hour engagement.

## Phase 8 — Billing + plans

- Stripe webhooks → `organizations.subscription_tier`.
- Plan caps on `credits_balance` + `monthly_credits_used`.
- Per-call cost calculation in `usage_logs` (already shipped) becomes the
  basis for in-product usage display.

## Phase 9 — Self-hosted LLM at scale

- Default `AI_PROVIDER=ollama` for self-host deployments.
- Pin `groq` for burst spikes when Ollama queue depth grows.
- vLLM cluster for the heavy customers.

## Cross-cutting

| Upgrade                         | Benefit                                          |
| ------------------------------- | ------------------------------------------------ |
| Redis + BullMQ                  | Priorities, concurrency limits, dead-letter q.   |
| OpenTelemetry traces            | Cross-service spans (n8n → engine → IG → DB).    |
| Observable cost / quality evals | `usage_logs` + prompt versions = ROI per change. |
| Encrypt IG tokens at rest       | `pgp_sym_encrypt` or KMS-managed.                |
| RLS policies                    | Open the DB to org users with safe scoping.      |

---

## Sequencing recommendation

1. **Verify the foundation works end-to-end** (one test carousel, one publish).
2. **Dashboard** (Phase 2) — biggest UX leap; brings the engine to the customer.
3. **Outbound + IG DM bridge** (Phase 4) — completes the "ads → leads → CRM" loop.
4. **Self-hosted images** (Phase 3) — biggest cost moat.
5. Everything else is incremental + can be sequenced by demand.
