# Content Engine — AI Instagram Content Automation (WappFlow module)

A multi-tenant, SaaS-ready engine that generates **on-brand Instagram
carousels and posts** for SMBs — captions, hashtags, AI-rendered images, and
auto-publishing — designed to run as a sibling service to WappFlow CRM.

Faceless, template-driven, low-infrastructure. Built so external paid APIs
can be **gradually replaced** with self-hosted equivalents (Ollama, ComfyUI,
Flux/SD).

---

## Table of contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Quickstart](#quickstart)
6. [Pipeline flow](#pipeline-flow)
7. [API surface](#api-surface)
8. [Cost model](#cost-model)
9. [Documentation](#documentation)

---

## What it does

Each tenant (organization) configures a **brand profile** (niche, tone, theme,
logo, voice keywords) and either:

- enters topics manually, **or**
- lets the topic engine AI-generate them.

On every run the engine:

1. Picks the next pending topic for the org.
2. Generates **structured carousel/post content** (hook, slides, CTA, caption,
   hashtags) in the brand's voice.
3. Composes each slide as **HTML + CSS** themed from the brand profile.
4. Renders the slides to PNG (Puppeteer + Sharp), uploads to Supabase Storage.
5. Enqueues the carousel/post in `publish_queue`.
6. The publish worker drives the **Instagram Graph API carousel flow** (child
   containers → carousel container → poll → publish).
7. Analytics are refreshed on a cron.

Manual-approval mode pauses between (5) and (6); the dashboard or WappFlow
calls `/api/tenant/carousels/:id/approve` when the human says go.

---

## Architecture

```
                        ┌────────────────────────────────────────┐
                        │                 n8n                     │
                        │  Schedule -> Run Pipeline -> IF -> Pub  │
                        │       (per-tenant orchestration)        │
                        └─────────────────────┬──────────────────┘
                                              │ HTTP (x-org-api-key / x-api-key)
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Content Engine  (Node + Express)                          │
│                                                                               │
│  topic -> content (LLM) -> render (HTML→PNG) -> upload -> enqueue publish    │
│                                                                               │
│  Internal scheduler: publish-queue · retry-worker · analytics                 │
└───┬─────────┬──────────┬──────────────┬──────────────┬──────────────┬────────┘
    │         │          │              │              │              │
    ▼         ▼          ▼              ▼              ▼              ▼
 Groq /    OpenAI /  Puppeteer +    Supabase       Instagram      WappFlow
 Ollama    ComfyUI/  Sharp slide   (DB + Storage)  Graph API      (webhooks)
 (LLM)     Fal       composition
           (images)
```

- **Orchestration plane (n8n)** — schedule + alert + per-tenant fan-out.
- **Execution plane (this service)** — multi-tenant TypeScript pipeline.
- **Tenancy** — every row carries `organization_id`. Per-tenant API keys.
  Per-tenant LLM provider/key overrides.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

---

## Tech stack

| Layer            | Technology                                                          |
| ---------------- | ------------------------------------------------------------------- |
| Orchestration    | n8n (self-hosted)                                                   |
| Runtime          | Node.js 20 + TypeScript                                             |
| HTTP             | Express                                                             |
| Database/storage | Supabase (Postgres + Storage)                                       |
| LLM              | Groq (free, default) · OpenAI (fallback) · Ollama (self-hosted)     |
| Image generation | OpenAI Images, ComfyUI / Fal stubs (Flux / SD — self-host roadmap)  |
| Slide rendering  | puppeteer-core (system Chrome) + Sharp + HTML/CSS templates         |
| Publishing       | Instagram Graph API (carousel + single)                             |
| Deployment       | Docker + Docker Compose                                             |

---

## Project structure

```
content-engine/
├── src/
│   ├── index.ts                 # entrypoint (server + scheduler)
│   ├── server.ts                # Express app factory
│   ├── middleware.ts            # tenant + ops auth, error handler
│   ├── types.ts                 # domain + DB row types
│   ├── config/                  # env validation + constants
│   ├── lib/                     # logger, supabase, storage, http, retry, errors
│   ├── db/repositories.ts       # tenant-aware data access
│   ├── ai/                      # llm provider abstraction + prompt library
│   ├── modules/
│   │   ├── brand/               # resolve brand profile + theme
│   │   ├── templates/           # template loader + defaults
│   │   ├── topics/              # topic lifecycle + AI topic generation
│   │   ├── content/             # carousel/post/caption/hashtag generation
│   │   ├── images/              # multi-provider image gen (openai/comfyui/fal)
│   │   ├── render/              # composer + Puppeteer + HTML templates
│   │   ├── publish/             # IG carousel + single + account resolution
│   │   ├── analytics/           # seed + refresh insights
│   │   └── logging/             # failed_jobs writer
│   ├── pipeline/pipeline.ts     # the orchestrator
│   ├── queue/                   # publish + retry workers
│   ├── scheduler/scheduler.ts   # internal cron jobs
│   └── routes/                  # HTTP API (tenant + ops + webhooks)
├── db/
│   ├── schema.sql               # full multi-tenant schema (18 tables + view)
│   └── seed.sql                 # 9 theme presets + system templates + demo org
├── workflows/
│   └── n8n-content-factory.json
├── scripts/                     # seed-themes.ts · test-pipeline.ts
├── docs/                        # ARCHITECTURE · DEPLOYMENT · INTEGRATION · ROADMAP
├── web/                         # Flux — Next.js 15 dashboard (see web/README.md)
├── Dockerfile  ·  docker-compose.yml  ·  .env / .env.example
└── package.json  ·  tsconfig.json
```

The `web/` directory is the **Flux dashboard** — a separate Next.js 15 app that
talks to this engine over HTTP. Run it from `web/` after the engine is up.
See [`web/README.md`](./web/README.md) for the design system and quickstart.

---

## Quickstart

### Prerequisites

- Node.js 20+ and npm (or Docker)
- A Supabase project
- A **Groq** API key (free — https://console.groq.com/keys)
- For image generation (optional): OpenAI key, ComfyUI server, or Fal key
- Chrome / Chromium installed locally (auto-detected) for the renderer

### 1. Configure

```bash
cd "content-engine"
cp .env.example .env   # already populated for this project — review
# Required to fill: GROQ_API_KEY
```

### 2. Database

Run **`db/schema.sql`** then **`db/seed.sql`** in the Supabase SQL editor.
Storage buckets are auto-created on first boot.

### 3a. Docker

```bash
docker compose up -d --build
# app  -> http://localhost:8090
# n8n  -> http://localhost:5679
```

### 3b. Local

```bash
npm install
npm run build && npm start
# or:  npm run dev
```

### 4. Test

```bash
npm run seed:themes      # verify themes + templates exist
npm run test:pipeline    # produce one full carousel for the demo org
```

### 5. n8n

Open n8n → **Import** → `workflows/n8n-content-factory.json` →
set `CONTENT_ENGINE_URL`, `CONTENT_ENGINE_API_KEY`, `ORG_API_KEY` env vars →
**Activate**. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Pipeline flow

| # | Step       | Module                                  | Output                                |
|---|------------|-----------------------------------------|---------------------------------------|
| 1 | topic      | `modules/topics`                        | pending `content_topics` row          |
| 2 | content    | `modules/content/carouselContentService`| hook + slides + caption + hashtags    |
| 3 | (images)   | `modules/images` (skipped if `none`)    | AI background per slide               |
| 4 | render     | `modules/render/composer`               | one PNG per slide                     |
| 5 | upload     | `lib/storage`                           | public URLs in `content-renders`      |
| 6 | enqueue    | `publish_queue`                         | scheduled publish job                 |
| — | publish    | `queue/publishWorker`                   | live Instagram carousel               |
| — | analytics  | `modules/analytics`                     | performance snapshots                 |

---

## API surface

| Method | Path                                       | Auth          | Purpose                                |
| ------ | ------------------------------------------ | ------------- | -------------------------------------- |
| GET    | `/health`                                  | —             | Healthcheck                            |
| GET    | `/api/tenant/me`                           | tenant        | Current org info                       |
| GET    | `/api/tenant/themes`                       | tenant        | List system theme presets              |
| GET    | `/api/tenant/templates`                    | tenant        | Templates available to the org         |
| GET    | `/api/tenant/brand`                        | tenant        | Default brand profile                  |
| POST   | `/api/tenant/brand`                        | tenant        | Create a brand profile                 |
| PATCH  | `/api/tenant/brand/:id`                    | tenant        | Update a brand profile                 |
| GET    | `/api/tenant/topics/next`                  | tenant        | Next pending topic                     |
| POST   | `/api/tenant/topics`                       | tenant        | Add topics                             |
| POST   | `/api/tenant/topics/generate`              | tenant        | AI-generate topics                     |
| POST   | `/api/tenant/pipeline/run`                 | tenant        | Run the pipeline (sync)                |
| GET    | `/api/tenant/pipeline/runs/:id`            | tenant        | Inspect a run                          |
| POST   | `/api/tenant/carousels/:id/approve`        | tenant        | Approve a manual-mode carousel         |
| POST   | `/api/tenant/posts/:id/approve`            | tenant        | Approve a manual-mode single post      |
| POST   | `/api/tenant/reels`                        | tenant        | Generate a cinematic reel from a carousel (async) |
| GET    | `/api/tenant/reels`                        | tenant        | List reels (optionally `?carouselId=`) |
| GET    | `/api/tenant/reels/:id`                    | tenant        | Reel status + URL (poll while rendering) |
| GET    | `/api/tenant/instagram-accounts`           | tenant        | Connected IG accounts (tokens hidden)  |
| POST   | `/api/ops/queue/process-publish`           | ops           | Drain the publish queue                |
| POST   | `/api/ops/queue/process-retries`           | ops           | Retry failed pipeline jobs             |
| POST   | `/api/ops/analytics/collect`               | ops           | Refresh insights                       |
| POST   | `/api/webhooks/wappflow?token=`            | token         | Inbound events from WappFlow           |
| POST   | `/api/webhooks/instagram?token=`           | token         | Inbound Instagram webhooks             |

- **tenant** = `x-org-api-key` header (the org's `api_key`).
- **ops** = `x-api-key` header (`INTERNAL_API_KEY`).
- **token** = `?token=<INTERNAL_API_KEY>` query param.

---

## Cost model

Designed to stay **near $0/month for dev** by defaulting to free tiers and
template-driven composition (no AI image generation needed):

| Service        | Default     | Cost                                                     |
| -------------- | ----------- | -------------------------------------------------------- |
| Groq (LLM)     | enabled     | **free** with rate limits                                |
| Image gen      | `none`      | **$0** — slides composed from brand colours + typography |
| Pexels / stock | not used    | **$0**                                                   |
| Puppeteer      | local       | **$0** (uses system Chrome)                              |
| Supabase       | free tier   | **$0** up to 500 MB DB + 1 GB storage                    |
| Instagram      | Graph API   | **$0**                                                   |

When you scale, the natural upgrades are: hosted Flux (Fal ~$0.02/image), then
self-hosted ComfyUI (GPU rental / on-prem).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — modules, data model, tenancy, retries, scaling
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — VPS setup, Supabase, Instagram, Chrome, production
- [`docs/INTEGRATION.md`](docs/INTEGRATION.md) — how this slots into WappFlow CRM
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's done in this foundation vs. next phases
- [`docs/PROVIDER-SETUP.md`](docs/PROVIDER-SETUP.md) — free-tier AI provider onboarding (which keys to get, where, how Flux orchestrates them)
- [`docs/FUTURE-AI-MEDIA-STUDIO.md`](docs/FUTURE-AI-MEDIA-STUDIO.md) — long-term vision: the AI Media Intelligence Studio (**deferred** — do not implement until the core platform is production-stable)
