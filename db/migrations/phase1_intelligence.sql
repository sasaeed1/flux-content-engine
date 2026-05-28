-- ============================================================================
--  Flux Phase 1 — intelligence + orchestration tables
--
--  All tables scoped by organization_id (or system-global where noted).
--  Apply by running this against the Supabase project. Idempotent —
--  every table is `IF NOT EXISTS`.
-- ============================================================================

-- ── provider quota tracking ────────────────────────────────────────────────
-- One row per (provider, key index, day). The router increments on each call
-- and reads to decide which provider to route to. Sliding window across days.
create table if not exists provider_quota_log (
  provider          text        not null,
  key_index         int         not null,
  day               date        not null,
  call_count        int         not null default 0,
  token_count       bigint      not null default 0,
  last_call_at      timestamptz not null default now(),
  primary key (provider, key_index, day)
);
create index if not exists idx_provider_quota_day on provider_quota_log (day desc);

-- ── deterministic response cache ──────────────────────────────────────────
-- Cache_key = sha256(provider:model:system:user:temp). Value = raw text
-- response. TTL enforced at read time (created_at + ttl_seconds).
create table if not exists ai_response_cache (
  cache_key     text        primary key,
  provider      text        not null,
  model         text        not null,
  response_text text        not null,
  hits          int         not null default 0,
  bytes         int         not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index if not exists idx_ai_cache_expires on ai_response_cache (expires_at);

-- ── content performance memory ────────────────────────────────────────────
-- Recorded after publish + analytics sync. Drives the personalization loop.
create table if not exists content_performance (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null references organizations(id) on delete cascade,
  carousel_id         uuid        references generated_carousels(id) on delete cascade,
  post_id             uuid        references generated_posts(id)     on delete cascade,
  hook_archetype      text,
  style_mode_key      text,
  cta_style           text,
  slide_count         int,
  views               int         default 0,
  likes               int         default 0,
  comments            int         default 0,
  saves               int         default 0,
  reach               int         default 0,
  engagement_rate     numeric(6,4) default 0,
  recorded_at         timestamptz not null default now()
);
create index if not exists idx_perf_org   on content_performance (organization_id, recorded_at desc);
create index if not exists idx_perf_hook  on content_performance (organization_id, hook_archetype, recorded_at desc);
create index if not exists idx_perf_style on content_performance (organization_id, style_mode_key, recorded_at desc);

-- ── style modes — the 40 visual style definitions ─────────────────────────
-- System-owned (organization_id NULL) seed rows + per-org custom modes.
create table if not exists style_modes (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        references organizations(id) on delete cascade,
  key               text        not null,
  name              text        not null,
  category          text,                       -- corporate | editorial | playful | luxury | tech
  description       text,
  emotional_tone    text,                       -- confident | cinematic | calm | aggressive
  layout            jsonb       not null default '{}'::jsonb,
  typography        jsonb       not null default '{}'::jsonb,
  palette           jsonb       not null default '{}'::jsonb,
  motion            jsonb       not null default '{}'::jsonb,
  effects           jsonb       not null default '{}'::jsonb,
  preview_url       text,
  is_system         boolean     not null default false,
  is_premium        boolean     not null default false,
  created_at        timestamptz not null default now()
);
create unique index if not exists idx_style_modes_key on style_modes (organization_id, key);
create index if not exists idx_style_modes_system on style_modes (is_system);

-- ── workspace modes — Creator / Campaign / Motion / Strategy / Analytics ──
create table if not exists workspace_modes (
  organization_id   uuid        primary key references organizations(id) on delete cascade,
  mode              text        not null default 'creator',
  metadata          jsonb       not null default '{}'::jsonb,
  updated_at        timestamptz not null default now()
);

-- ── command palette history (for the Cmd-K palette) ──────────────────────
create table if not exists command_history (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,
  raw_input         text        not null,
  parsed_action     text,
  arguments         jsonb,
  succeeded         boolean,
  latency_ms        int,
  created_at        timestamptz not null default now()
);
create index if not exists idx_cmd_history_org on command_history (organization_id, created_at desc);

-- ── AI insights cache — the cards rendered on Dashboard/Library ──────────
-- Refreshed in the background; the UI reads from this table for instant
-- render. Each insight is scoped to an org and a surface (where it appears).
create table if not exists ai_insights (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,
  surface           text        not null,           -- 'dashboard' | 'library' | 'studio'
  kind              text        not null,           -- 'trend' | 'optimization' | 'next-action'
  headline          text        not null,
  body              text,
  cta_label         text,
  cta_href          text,
  score             numeric(4,2) default 0,         -- ranking weight
  dismissed_at      timestamptz,
  expires_at        timestamptz not null default (now() + interval '24 hours'),
  created_at        timestamptz not null default now()
);
create index if not exists idx_insights_org_surface on ai_insights (organization_id, surface, dismissed_at, expires_at);

-- ── assets library — reusable overlays, textures, motion presets ──────────
-- System-owned seed assets + per-org uploads.
create table if not exists asset_library (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        references organizations(id) on delete cascade,
  kind              text        not null,           -- 'overlay' | 'texture' | 'gradient' | 'motion-preset' | 'icon-pack'
  name              text        not null,
  storage_path      text,
  preview_url       text,
  metadata          jsonb       not null default '{}'::jsonb,
  is_system         boolean     not null default false,
  is_premium        boolean     not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists idx_assets_kind on asset_library (kind, is_system);
