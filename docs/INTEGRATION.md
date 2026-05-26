# WappFlow Integration

The content engine is a **sibling service** to WappFlow CRM. It runs on its
own port (8090) and Supabase project (or schema), with HTTP / webhook hooks
into WappFlow for end-to-end "Instagram → CRM → WhatsApp" flows.

```
                   ┌────────────────────────┐
                   │       WappFlow CRM     │
                   │  (Express + SQLite)    │
                   └──────┬─────────────────┘
                          │  HTTP / webhooks
       ┌──────────────────┼──────────────────────┐
       │                  │                      │
       ▼                  ▼                      ▼
  Content Engine     n8n orchestration      WhatsApp service
  (Node + Supabase)  (per-org workflows)    (WappFlow internal)
```

## 1. Why a sibling, not embedded

| Reason                            | Why it matters                                              |
| --------------------------------- | ----------------------------------------------------------- |
| Different storage (Postgres vs SQLite) | Schema, scale and pooling characteristics diverge.       |
| Different scale profile           | Render workers + browsers can be scaled independently.      |
| SaaS-shaped tenancy               | Per-org API keys, RLS-ready, per-tenant LLM provider keys.  |
| Cleaner deployment surface        | Each service has its own Docker compose, Caddy host.        |
| Independent rollout / rollback    | Updates to content engine never risk the CRM.               |

WappFlow keeps owning: auth/users, contacts, messages, WhatsApp, CRM data.
Content engine owns: brand profiles, templates, generated content, IG posts.

## 2. How WappFlow talks to the content engine

### 2.1 Tenant operations (org API key)
WappFlow stores each customer org's `content-engine api_key` (returned when
the org is provisioned). All tenant-scoped calls send it:

```
POST https://content-engine.../api/tenant/pipeline/run
  x-org-api-key: <org_api_key_from_wappflow>
  body: { "approvalMode": "manual" }
```

A typical WappFlow → content-engine usage map:

| WappFlow user action                  | Content engine call                        |
| ------------------------------------- | ------------------------------------------ |
| Customer opens "Content" tab          | `GET /api/tenant/me`                       |
| Sets up brand for the first time      | `POST /api/tenant/brand`                   |
| Enters topics manually                | `POST /api/tenant/topics`                  |
| Clicks "Suggest topics"               | `POST /api/tenant/topics/generate`         |
| Clicks "Generate carousel"            | `POST /api/tenant/pipeline/run` (manual)   |
| Reviews and clicks "Publish"          | `POST /api/tenant/carousels/:id/approve`   |
| Sees performance                      | (queries `analytics` directly via Supabase)|

### 2.2 Ops operations (internal API key)
WappFlow's backend jobs / n8n can also hit ops endpoints to drive the queue:

```
POST /api/ops/queue/process-publish   x-api-key: INTERNAL_API_KEY
POST /api/ops/queue/process-retries   x-api-key: INTERNAL_API_KEY
POST /api/ops/analytics/collect       x-api-key: INTERNAL_API_KEY
```

These are intended for n8n / cron / WappFlow back-channel only.

## 3. How the content engine talks back to WappFlow

### 3.1 Outbound webhook
Set `WAPPFLOW_WEBHOOK_URL` + `WAPPFLOW_WEBHOOK_SECRET` in `.env`. The engine
can fire events on relevant transitions:

| Event                | Payload                                                 |
| -------------------- | ------------------------------------------------------- |
| `post.published`     | `{ orgId, postId|carouselId, igMediaId, permalink }`    |
| `post.failed`        | `{ orgId, runId, error, step }`                         |
| `analytics.updated`  | `{ orgId, postId, snapshot }`                           |

> Outbound dispatch is wired as a hook point (TODO in next session — emit
> from publishWorker.publishOne and analyticsService.refreshPost).

### 3.2 Inbound webhook
`POST /api/webhooks/wappflow?token=<INTERNAL_API_KEY>` accepts events from
WappFlow. The engine logs them to `webhook_events`. Use this to plug:

- **Lead-from-DM** — WappFlow notifies content engine when a DM came in via
  the engine's published post; engine can adjust topic priority or generate
  a follow-up post variant.
- **Calendar update** — WappFlow propagates a content_calendar change.
- **Disconnect** — WappFlow tells engine to mark an `instagram_account`
  inactive when the customer disconnects from the CRM.

## 4. Future flow — Instagram lead → WhatsApp follow-up

The architecture supports this end-to-end without changes:

```
1. Content engine publishes a carousel with CTA "DM us KEYWORD"
2. IG webhook (incoming DM) hits content engine:
     POST /api/webhooks/instagram?token=...
   -> insert webhook_events
3. A worker resolves the org (by IG account id) and forwards to WappFlow:
     POST {WAPPFLOW_WEBHOOK_URL}/leads/new
     { orgId, source:"instagram_dm", igUsername, message }
4. WappFlow creates a contact + opens a WhatsApp thread.
```

For phase 2: implement the IG DM forwarder as a `webhook_events` worker.

## 5. Auth bridge (next session)

For tighter SSO between dashboards:

- WappFlow signs a short-lived JWT containing `organizationId` + `userId`.
- Content engine validates the JWT and resolves the same org by id.
- Replaces the per-request `x-org-api-key` for browser clients while keeping
  the API key for server-to-server.

The schema is ready: `users` + `org_memberships` mirror what WappFlow already
models, so a one-time backfill aligns identities.
