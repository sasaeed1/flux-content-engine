# Flux — Complete Breakdown

_A full reference of what Flux is, every feature, and the architecture. Current as of 2026-06-05._

---

## 1. What Flux is

**Flux is an AI content desk for SMBs, creators, and agencies** — it researches, writes, designs, captions, animates, and queues social content end-to-end, so a business can post daily without hiring a designer or a social team.

**One-liner:** _"Your AI social media team. On the payroll for $19."_

You give it a topic (or let it generate topics from your brand + the web); Flux returns a finished, on-brand Instagram **carousel** — hook, body slides, CTA, caption, hashtags, rendered images — that you review, edit, approve, and publish. It also turns those slides into **cinematic video reels**, plans a **month of content** at a glance, cross-posts to **multiple platforms**, and now ships an **AI Media Intelligence Studio** that scores, ranks, enhances, reframes, and treats your raw photos into production-ready assets.

It is a **multi-tenant SaaS module of WappFlow** (the parent product), with single-sign-on from WappFlow and free-tier-first economics (runs on free LLMs + local rendering, so the marginal cost of a carousel is ~zero).

**Design philosophy:** a cinematic, AI-native UX (the references were Midjourney / Linear / Framer / Notion AI / Arc) — command palette, AI presence, workspace "modes," an always-on engine pulse — over a deterministic, reproducible content pipeline. The guiding principle throughout: **the AI is the creative director / decision-maker; deterministic systems execute** the rendering, editing, grading, and publishing.

---

## 2. System at a glance

Two deployables + Supabase, multi-tenant by `organization_id`:

| Component | What it is | Stack |
|---|---|---|
| **Content Engine** (`flux-content-engine`) | The backend API + AI pipeline + renderers | Node 20+ / TypeScript, Express, port 8090 |
| **Flux Web** (`web/`) | The dashboard / app + marketing site | Next.js 15 (App Router), React 18, Tailwind, framer-motion, port 3010→3000 |
| **Supabase** | Postgres (data) + Storage (images/reels/media) | Managed; service-role access from the engine |
| **n8n** | External scheduler that triggers per-org pipelines | Containerized alongside |

- **Tenant auth:** every org has an API key; the engine authenticates tenant calls via the `x-org-api-key` header. The web app holds the key server-side only (httpOnly cookies after SSO) — it never reaches the browser.
- **AI keys are backend-only** (never exposed to the client).
- **Hosting:** Hetzner (`78.47.224.70`), Docker Compose (`content-engine-app`, `flux-web`, `content-engine-n8n`), reverse-proxied at **flux.remoteops.co**.

---

## 3. Product surfaces (the app)

The web app is organized **by intent** (Discover / Create / Manage), with a persistent command rail, a workspace-mode switcher, a Cmd-K command palette, a contextual Copilot, and an ambient "engine pulse."

| Route | Surface | What it does |
|---|---|---|
| `/` | **Landing** | Marketing site — hero, animated metrics, value props, "more than carousels," old-vs-Flux comparison, 4-tier pricing, FAQ. Scroll-reveal motion (framer-motion). |
| `/login`, `/signup` | **Auth** | Email auth + WappFlow SSO entry. |
| `/home` | **Mission Control** | AI daily brief, telemetry (pending/ready/scheduled/published), opportunity feed (trends + optimizations), "continue creating," trending sparks, engine pulse log. |
| `/forge` | **The Forge** | The generation chamber — type a topic, pick slide count (Auto/5/7/9) + style mode + "draft first" toggle, watch Flux co-create live (SSE streaming, slide-by-slide). |
| `/motion` | **Motion Studio** | Cinematic reels gallery + the reel renderer (aspect + motion preset + kinetic-intro toggle). |
| `/media` | **Media Studio** | AI Media Intelligence Studio — upload photos → score → rank → AI director verdict → enhance → reframe → text-ready backgrounds. |
| `/campaign` | **Campaign Calendar** | Plan a month: generate topics (brand-website + trends grounded), website-topic override, content-pillar clustering, drag onto days, "Forge the month." |
| `/library` | **The Library** | Every carousel — filter (All/Ready/Drafts/Scheduled/Published), edit, restyle, bulk-approve, publish to channels, render reels. |
| `/library/[id]` | **Carousel detail** | Slide strip, caption/CTA editors, AI rewrite, restyle, approval bar, publish-to-channels picker, reel studio. |
| `/brand` | **Brand Studio** | Voice tab (identity, website, voice, theme, personality sliders) + Looks tab (40 style modes + theme presets). |
| `/signals` | **Signals** | Performance intelligence — top hooks/styles/CTAs by engagement, weekly briefing, insights. |
| `/settings` | **Settings** | Sticky section-nav: Workspace, Defaults (generation/motion/SEO/notifications), Brand kit, Instagram, Channels, API key, Plan & usage, Danger zone. |
| `/help` | **Help center** | Flow, "beyond carousels," keyboard shortcuts, Instagram setup, refreshed FAQ, contact. |

**Cross-app UX primitives:** Command palette (⌘K — navigate + run actions + AI mode), Copilot (⌘J), account menu (Settings / Help / Log out), workspace-mode switcher, engine pulse, mobile nav.

---

## 4. The core content pipeline

The heart of Flux. A topic in → a finished carousel out, as a deterministic, observable pipeline (`src/pipeline/`):

```
topic_resolved → brand_loaded → content_generated → slide_rendered ×N
   → render_complete → enqueued / awaiting_approval → complete
```

1. **Resolve topic** — from the calendar queue, an explicit id, or ad-hoc input.
2. **Load brand** — voice, tone, keywords, personality, theme/style DNA (falls back to neutral defaults so generation always works).
3. **Generate content** — the LLM writes the carousel: title, hook, per-slide body (matching the template's slot schema), CTA, caption, hashtags — in the brand voice, biased by personality sliders, diversified across hook archetypes + layout archetypes, de-duplicated against recent posts.
4. **Render slides** — deterministic HTML templates → headless Chromium (Puppeteer) → pixel-perfect PNGs (per-slide), uploaded to Supabase Storage.
5. **Persist** — a `generated_carousels` row (`draft` if draft-first, else `ready`), with run telemetry in `pipeline_runs`.
6. **Approve / publish** — manual by default; on approval, enqueued to the publish queue.

**Modes:**
- **Streaming** (`/pipeline/run-stream`, SSE) — the Forge shows each step live.
- **Draft-first** — stop after content (no render) so you can edit scripts fast, then render on command.
- **Batch ("Forge the month")** — produce a finished carousel per pending topic, sequentially, in the background.

**Editing (`edit.routes`):** inline caption edit + AI rewrite (shorter / professional / casual / stronger CTA), CTA edit + variations, per-slide edit + AI rewrite, **restyle** (apply a different style mode + re-render), on-command render, bulk-approve.

---

## 5. AI provider plane

A resilient, **free-tier-first** multi-provider router (`src/ai/`) so generation is cheap and never single-points-of-failure:

- **8 providers:** Groq, Cloudflare Workers AI, Google Gemini, OpenRouter, Hugging Face, Together, OpenAI, Ollama.
- **Multi-key rotation** per provider, **daily quota caps**, **circuit breaker** (skips failing providers), **response cache**, **fast vs. reasoning tiers**, automatic **failover**, and `ALLOW_PAID_FALLBACK` to gate paid models.
- All keys are **backend-only**. Per-org provider/key overrides supported.
- Config source of truth is `src/config/env.ts` (multi-provider keys, quota vars).
- Exposed via the intelligence plane (`/tenant/intelligence/providers` shows status + today's usage).

---

## 6. Brand system

Everything that makes output unmistakably "you":

- **Brand profile** — name, niche, business type, **website**, tone, post style, CTA style, voice keywords (always-use) + voice-avoid (never-use), logo.
- **Personality sliders** — Boldness / Minimalism / Luxury / Energy (0–1), stored in brand metadata, fed into every generation (copy + visual feel).
- **Brand DNA AI extraction** — drop a logo / brand book / style guide / pitch deck (PDF/PNG/SVG); Flux extracts colors, typography, tone, voice and proposes them to apply (`/brand/dna/apply`).
- **Theme presets** — 9 color+type packs (Minimal, Bold, Editorial, Dark Luxe, Pastel, Cyber, Organic, Studio, Reset).
- **40 cinematic style modes** (`src/modules/styles/`) — each a full personality: typography, palette, **motion philosophy** (still→kinetic) + intensity, effects. Seeded on boot, browsable in Brand Studio → Looks, applied at forge time, and they drive reel motion.

---

## 7. Motion / Cinematic Reels engine

Turns carousel slides into real **9:16 (or 1:1 / 4:5) MP4 reels** — **zero API/GPU cost**, using bundled `ffmpeg-static` (no system ffmpeg):

- Per-slide **Ken Burns** (`zoompan`) → **xfade** cinematic transitions → film grain + vignette → **cinematic colour grade** (eq + teal/orange `colorbalance`) + **filmic motion blur** (`tmix`).
- **Style-driven presets** — each style mode's `motion.philosophy` + intensity selects the recipe (still / subtle / dynamic / cinematic / kinetic), scaling hold time, transition speed, zoom, grain, grade, blur.
- **Kinetic typography intro** (opt-in) — an animated hook card rendered frame-by-frame via Web Animations in headless Chromium, crossfaded onto the Ken Burns body.
- Bitrate-capped (~2.8 MB / 8s), `+faststart`, async render with polling. Remote slides are localized to temp files first (a hard-won fix: the static ffmpeg segfaults on `https` inputs in-container).
- Stored in the `content-reels` bucket; tracked in `generated_reels`.

---

## 8. AI Media Intelligence Studio (`/media`)

Upload raw photos → agency-quality, production-ready assets. **Phase 1 (images) is complete**, all CPU-only via `sharp`/libvips (zero API cost):

- **Module 1 — Intelligence:** quality scoring (sharpness/blur, exposure, contrast, resolution, composition, overall social-suitability) + flags + dominant color → assets **ranked best-first**.
- **Module 2 — Enhancement:** auto colour-correct, contrast stretch, sharpen, Lanczos **upscale**, subtle **brand grade**.
- **Module 3 — Smart reframe:** subject-aware crops (libvips attention smart-crop) to **1:1 / 4:5 / 9:16**.
- **Module 3 — Layout-aware backgrounds:** text-ready slide backgrounds (**scrim / frost / on-brand duotone**) at 4:5 with a readability gradient.
- **AI creative director:** the LLM reviews the ranked set, picks the **hero shot**, and gives actionable notes.

Backed by `media_assets` + the `media-studio` bucket. **Future phases (documented, not built):** Video Studio (M4–M7: multi-clip ingest, scene/clip scoring, highlight detection, story assembly, stabilization/reframe/grade, auto-editing + captions), background removal/cutout (needs ML), brand-consistency engine (M8). See `docs/FUTURE-AI-MEDIA-STUDIO.md`.

---

## 9. Multi-platform publishing

Cross-post carousels (and reels) to multiple networks via a **publisher registry** (`src/modules/publish/platforms/`):

- **Instagram** — Graph API (carousels + single posts) via per-account token.
- **LinkedIn** — UGC Posts API (register-upload → upload → post), member/org token + author URN.
- **TikTok** — Content Posting API (Direct Post; video + photo via PULL_FROM_URL).
- **Channels UI** in Settings (connect / disconnect / status per platform); per-carousel **"Publish to channels"** picker that fans out and shows per-platform results.
- Connections stored in `social_connections`. One-click OAuth activates when each platform's app keys are added; manual-token connect works immediately.
- Publishing flow: approve → `publish_queue` → background workers publish + record to `published_posts`; retries via `failed_jobs` + a retry worker.

---

## 10. Topic & content intelligence

The "research + strategy" brain (`src/routes/intelligence.routes.ts`, `src/modules/topics/`):

- **Topic generation** — on-brand ideas grounded in the brand's **website** (fetched + extracted) + **timely/trending** angles; SEO-bias toggle.
- **Website analysis** — paste any URL → on-brand topics from what the brand actually does (SSRF-guarded fetch).
- **Content-pillar clustering** — group the topic queue into 3–6 named themes (label + summary + member topics).
- **Topic scoring** — SEO / virality / engagement / audience scores.
- **Viral hook engine** — generate hooks by archetype, brand-voiced, history-deduped, performance-aware, scored.
- **Insights** — AI cards for Home/Library; weekly briefing.
- **Performance memory** — top hooks/styles/CTAs by real engagement feed back into future generation (a closed performance loop fed by IG analytics).
- **Command** — Cmd-K natural language → action.
- **Memory recall** — top hooks/themes/CTAs for the brand.

---

## 11. Workspace UX layer

- **Workspace modes** — Creator / Campaign / Motion / Strategy / Analytics. Selecting one **navigates** to that mode's surface (creator→Forge, campaign→Campaign, motion→Motion, strategy→Home, analytics→Signals) and the active mode reflects the current route + tints the accent.
- **Command palette (⌘K)** — jump anywhere, run actions (forge, generate topics, run pipeline, browse styles, open help), AI mode.
- **Copilot (⌘J)** — contextual AI assistant panel.
- **Engine pulse** — ambient AI-activity heartbeat (rail + topbar).
- **AI presence cards**, page transitions, mobile nav.

---

## 12. Architecture (engine internals)

```
src/
  index.ts            entrypoint (boot, ensure buckets, cron scheduler)
  server.ts           Express app (security headers, IP rate-limit, JSON 16MB)
  config/env.ts       zod-validated env (providers, quotas, storage, SSO…)
  routes/             health, tenant, pipeline, edit, intelligence, reels,
                      settings, social, media, ops, sso, webhooks (+ index)
  middleware.ts       requireTenant / requireOps / asyncHandler
  ai/                 provider plane (router, providers, cache, quota, circuit breaker, llm, prompts)
  pipeline/           the generation pipeline + SSE events
  modules/
    brand/            brand resolution + theme merge + DNA extraction
    content/          carousel content gen, history/diversity, edit service
    topics/           topic engine + website analysis + clustering
    styles/           40 style modes + loader
    templates/        template definitions + slot schemas
    render/           HTML templates + Puppeteer composer (slides → PNG)
    motion/           reel composer (ffmpeg), presets, kinetic typography
    media/            image intelligence, enhance, reframe, backgrounds, service
    publish/          Instagram service + platform registry (IG/LinkedIn/TikTok) + queue
    intelligence/     performance memory, insight prompts
    settings/         org settings (validated, behaviour-driving)
  lib/                supabase, storage, http, retry, logger, errors, rateLimit, sso, microCache
  db/                 repositories (typed data access)
```

- **Web** (`web/src/`): Next.js App Router. `app/(app)/*` = authed surfaces (server components + server actions + an SSE streaming hook). `lib/api-client.ts` = the server-only engine client. `components/` organized by domain (forge, campaign, library, brand, motion, media, settings, nav, flux primitives). Design tokens via Tailwind (`solid-card`, `bg-flux-gradient`, `glow-cta`, `gradient-text`, …).

---

## 13. Data model (Supabase Postgres)

**Core (schema.sql):** `organizations`, `users`, `org_memberships`, `theme_presets`, `brand_profiles`, `templates`, `instagram_accounts`, `content_calendars`, `content_topics`, `pipeline_runs`, `generated_posts`, `generated_carousels`, `generated_assets`, `publish_queue`, `published_posts`, `analytics`, `failed_jobs`, `usage_logs`, `webhook_events`.

**Added this cycle (migrations):** `generated_reels` (motion), `social_connections` (multi-platform publishing), `media_assets` (Media Studio). Plus intelligence/experiment tables (insights, performance memory, A/B experiments).

**Conventions:** every row is org-scoped (`organization_id`); tenant data is partitioned in Storage under `orgs/{orgId}/…`; jsonb `metadata` columns hold flexible per-feature data (brand personality + website, settings, media analysis + crops + backgrounds, etc.); service-role access (RLS off, app enforces tenancy).

---

## 14. API surface (engine)

All tenant routes require `x-org-api-key`; ops routes require `x-api-key`; SSO + webhooks self-authenticate.

**Tenant / workspace:** `GET /tenant/me`, `/tenant/overview`, `/tenant/themes`, `/tenant/templates`.
**Brand:** `GET/POST /tenant/brand`, `PATCH /tenant/brand/:id`, `GET/POST/DELETE /tenant/brand/assets`, `POST /tenant/brand/assets/:id/extract`, `POST /tenant/brand/dna/apply`.
**Topics / calendar:** `GET /tenant/topics`, `GET /tenant/topics/next`, `POST /tenant/topics`, `PATCH/DELETE /tenant/topics/:id`, `POST /tenant/topics/generate`, `POST /tenant/topics/from-website`.
**Pipeline:** `POST /tenant/pipeline/run`, `/run-stream` (SSE), `/batch`, `GET /tenant/pipeline/runs`, `/runs/:id`.
**Carousels:** `GET /tenant/carousels`, `/carousels/:id`, `POST /carousels/:id/approve`, `/posts/:id/approve`.
**Editing:** `POST /carousels/:id/{caption,caption/rewrite,cta,cta/rewrite,slides/:idx,slides/:idx/rewrite,restyle,render}`, `POST /carousels/bulk/approve`.
**Reels:** `GET /tenant/reels`, `/reels/:id`, `POST /tenant/reels`.
**Intelligence:** `GET /tenant/intelligence/providers`, `POST /hooks`, `/topics/score`, `/topics/cluster`, `GET /insights`, `/styles`, `/weekly`, `/performance*`, `POST /command`, `GET /memory/recall`, `GET/POST /workspace-mode`.
**Media Studio:** `GET/POST /tenant/media`, `POST /media/director`, `/media/:id/{enhance,reframe,backgrounds}`, `DELETE /media/:id`.
**Channels:** `GET/POST /tenant/connections`, `DELETE /connections/:id`, `POST /carousels/:id/publish-to`.
**Instagram:** `GET/POST /tenant/instagram-accounts`, `DELETE /instagram-accounts/:id`.
**Settings:** `GET/PATCH /tenant/settings`.
**Ops (cron/n8n):** `POST /ops/queue/process-publish`, `/queue/process-retries`, `/analytics/collect`.
**SSO / webhooks / health:** `POST /sso/exchange`, `POST /webhooks/{wappflow,instagram}`, `GET /webhooks/instagram` (verify), `GET /health`.

---

## 15. Security & reliability

- **Rate limiting** (`src/lib/rateLimit.ts`): global per-IP limiter + per-org `generationRateLimit` (20/min default) on every LLM/render endpoint; `RateLimit-*` + `Retry-After` headers; 429 `RateLimitError`. (In-memory fixed-window; swap to Redis when multi-replica.)
- **Security headers** (nosniff / frame-deny / referrer), `x-powered-by` off, trust-proxy on, JSON capped at 16 MB.
- **Tenant isolation** — strict org scoping on every query; AI + platform credentials server-only.
- **SSRF guards** on website fetches; secrets never echoed to the client.
- **Resilience** — provider circuit breaker + failover; publish retry worker; graceful neutral-brand fallback; pipeline per-topic isolation so one failure doesn't sink a batch.

---

## 16. Deployment & ops

- **Host:** Hetzner `78.47.224.70` (`wappflow-prod`), `/opt/flux` (git clone of `main`).
- **Deploy:** `git pull --ff-only && docker compose up -d --build` (3 containers, bound to 127.0.0.1, reverse-proxied → flux.remoteops.co).
- **Supabase** project `tpundxnmwfmgrnxjzrir`; **no psql on the box** → DB migrations run in the Supabase SQL editor (service-role / "Run without RLS").
- **Scheduling:** internal cron (publish queue, retries) + n8n triggers per-org pipelines (the daily cron is off by default; n8n owns cadence).
- **Storage buckets:** `content-images`, `content-renders`, `brand-logos`, `content-reels`, `media-studio` (auto-provisioned on boot).

---

## 17. Pricing (positioning)

Pay-by-output, no token math:

| Tier | Price | For |
|---|---|---|
| **Free** | $0 | 5 carousels/mo, 40 style modes, local reels, manual approval, 1 brand · 1 IG |
| **Starter** | $19/mo | 50 carousels/mo, no watermark, auto-schedule, inline rewrites, 2 brands · 2 IG |
| **Growth** | $49/mo | 250 carousels/mo, multi-brand, analytics, brand-kit ingestion, 5 brands · 5 IG |
| **Agency** | $149/mo | unlimited brands/IG, client approval links, white-label, team, dashboards |
| **Enterprise** | custom | self-host, BYOK, SSO, audit logs, custom rendering, SLA |

Included free for WappFlow Growth+ customers (sign in from the WappFlow dashboard).

---

## 18. Tech stack (quick reference)

- **Engine:** TypeScript, Express, Supabase JS, `sharp` (libvips), `ffmpeg-static`, `puppeteer-core` (+ system Chromium), `openai` SDK (+ custom providers), `pdf-parse`, `handlebars`, `node-cron`, `pino`, `zod`, `axios`.
- **Web:** Next.js 15 (App Router), React 18, Tailwind 3.4 (+ animate), `framer-motion` 11, `lucide-react`, Radix UI primitives, CVA + clsx + tailwind-merge.
- **Data/infra:** Supabase (Postgres + Storage), Docker Compose, n8n, Hetzner, Nginx reverse proxy.

---

## 19. The vision (north star)

Flux is evolving from a **content generator** into a full **AI creative production studio**: upload raw images and video and receive agency-quality, finished assets with minimal manual editing — the AI acting as creative director (understand → score → rank → enhance → art-direct → assemble → brand), with deterministic, reproducible systems executing the media work. The carousel engine, motion engine, and image studio are the foundation already shipped; the video studio and brand-consistency engine are the next phases (`docs/FUTURE-AI-MEDIA-STUDIO.md`).
