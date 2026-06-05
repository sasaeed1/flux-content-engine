-- ============================================================
--  CONTENT ENGINE — Multi-tenant Supabase / PostgreSQL schema
--  Postgres 15+ (gen_random_uuid() is built-in).
--
--  Tenancy model:
--    - `organizations` is the tenant root. Every business row has
--      `organization_id` and is scoped on every query.
--    - The service connects with the service-role key and bypasses RLS.
--      If exposing tables to anon/auth keys later, enable RLS and add
--      per-table policies keyed on auth.uid()/jwt -> org membership.
--    - `theme_presets` and system `templates` (org_id is NULL) are global.
--
--  This schema replaces the previous (video-era) tables. The block below
--  drops them — they held only test data. Comment out the DROP block if
--  you want to keep them.
-- ============================================================

-- ---------- (optional) cleanup of the previous video-era schema ----------
drop view  if exists v_pipeline_overview        cascade;
drop table if exists analytics                  cascade;
drop table if exists failed_jobs                cascade;
drop table if exists published_posts            cascade;
drop table if exists publish_queue              cascade;
drop table if exists rendered_videos            cascade;
drop table if exists generated_assets           cascade;
drop table if exists generated_scripts          cascade;
drop table if exists pipeline_runs              cascade;
drop table if exists content_calendar           cascade;
drop table if exists accounts                   cascade;

-- ---------- shared helper: auto-update updated_at ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
--  1. organizations  — tenant root
-- ============================================================
create table if not exists organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique,
  api_key             text unique not null,
  ai_provider         text check (ai_provider in ('groq','openai','ollama')),
  ai_provider_key     text,           -- per-tenant override; move to vault in prod
  subscription_tier   text not null default 'free'
                        check (subscription_tier in ('free','starter','pro','business')),
  credits_balance     integer not null default 0,
  monthly_credits_used integer not null default 0,
  active              boolean not null default true,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_org_slug on organizations (slug);

-- ============================================================
--  2. users + org membership
-- ============================================================
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,
  name        text,
  avatar_url  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists org_memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  role            text not null default 'member'
                    check (role in ('owner','admin','editor','viewer','member')),
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists idx_memberships_user on org_memberships (user_id);
create index if not exists idx_memberships_org  on org_memberships (organization_id);

-- ============================================================
--  3. theme_presets  — global visual themes (no organization_id)
-- ============================================================
create table if not exists theme_presets (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,
  name          text not null,
  description   text,
  preview_url   text,
  colors        jsonb not null default '{}'::jsonb,
  typography    jsonb not null default '{}'::jsonb,
  effects       jsonb not null default '{}'::jsonb,
  visual_tone   text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
--  4. brand_profiles  — per-org brand identity
-- ============================================================
create table if not exists brand_profiles (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  name              text not null default 'Default',
  theme_preset_id   uuid references theme_presets(id) on delete set null,
  niche             text,
  business_type     text,
  tone              text,                          -- motivational | expert | friendly | bold | playful
  post_style        text,                          -- educational | promotional | viral | quote
  cta_style         text,
  logo_url          text,
  logo_storage_path text,
  colors            jsonb not null default '{}'::jsonb,    -- overrides preset
  typography        jsonb not null default '{}'::jsonb,    -- overrides preset
  voice_keywords    text[] not null default '{}',
  voice_avoid       text[] not null default '{}',
  is_default        boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_brand_org on brand_profiles (organization_id);
create unique index if not exists idx_brand_default_per_org
  on brand_profiles (organization_id) where is_default = true;

-- ============================================================
--  5. templates  — post/carousel layout templates (system + per-org)
-- ============================================================
create table if not exists templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name            text not null,
  key             text not null,
  type            text not null
                    check (type in ('single','carousel','quote','cta','announcement','lead_magnet','promotional','educational')),
  slide_count     integer,             -- only meaningful for carousels
  definition      jsonb not null,      -- the template body (slots, layout, defaults)
  preview_url     text,
  is_system       boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- system templates are globally unique by key
create unique index if not exists idx_template_system_key
  on templates (key) where organization_id is null;
-- org-scoped templates are unique by key within an org
create unique index if not exists idx_template_org_key
  on templates (organization_id, key) where organization_id is not null;
create index if not exists idx_template_type on templates (type);

-- ============================================================
--  6. instagram_accounts  — per-org connected IG accounts
-- ============================================================
create table if not exists instagram_accounts (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations(id) on delete cascade,
  ig_business_account_id   text not null,
  ig_access_token          text not null,    -- encrypt at rest in prod
  token_expires_at         timestamptz,
  username                 text,
  profile_picture_url      text,
  followers_count          integer,
  active                   boolean not null default true,
  is_default               boolean not null default false,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_ig_org on instagram_accounts (organization_id);
create unique index if not exists idx_ig_business_id on instagram_accounts (ig_business_account_id);

-- ============================================================
--  7. content_calendars  — automation profiles per org
-- ============================================================
create table if not exists content_calendars (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  name                   text not null default 'Default',
  brand_profile_id       uuid references brand_profiles(id) on delete set null,
  instagram_account_id   uuid references instagram_accounts(id) on delete set null,
  default_template_id    uuid references templates(id) on delete set null,
  niche                  text,
  posting_frequency      text not null default 'daily'
                           check (posting_frequency in ('daily','every_2_days','weekdays_only','3x_week','weekly')),
  post_time_local        time not null default '09:00:00',
  timezone               text not null default 'UTC',
  approval_mode          text not null default 'auto'
                           check (approval_mode in ('auto','manual')),
  topic_source           text not null default 'manual'
                           check (topic_source in ('manual','ai','both')),
  active                 boolean not null default true,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_calendars_org on content_calendars (organization_id);

-- ============================================================
--  8. content_topics  — scheduled topics within a calendar
-- ============================================================
create table if not exists content_topics (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  calendar_id           uuid references content_calendars(id) on delete set null,
  topic                 text not null,
  angle                 text,
  post_type             text not null default 'carousel'
                          check (post_type in ('single','carousel','quote','cta','announcement','lead_magnet','promotional','educational')),
  scheduled_date        date not null default current_date,
  priority              integer not null default 0,
  status                text not null default 'pending'
                          check (status in ('pending','processing','generated','approved','rejected','published','failed','skipped')),
  source                text not null default 'manual'
                          check (source in ('manual','ai','trend','dm_inbound')),
  attempts              integer not null default 0,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_topics_org_status on content_topics (organization_id, status, scheduled_date, priority desc);
create index if not exists idx_topics_calendar on content_topics (calendar_id);

-- ============================================================
--  9. pipeline_runs  — per-org production runs
-- ============================================================
create table if not exists pipeline_runs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  topic_id          uuid references content_topics(id) on delete set null,
  type              text not null default 'carousel'
                      check (type in ('single','carousel','batch')),
  status            text not null default 'running'
                      check (status in ('running','completed','failed','cancelled')),
  current_step      text,
  steps_completed   text[] not null default '{}',
  error             text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_runs_org_status on pipeline_runs (organization_id, status);
create index if not exists idx_runs_topic on pipeline_runs (topic_id);

-- ============================================================
--  10. generated_posts  — single-image post output
-- ============================================================
create table if not exists generated_posts (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  topic_id            uuid references content_topics(id) on delete set null,
  run_id              uuid references pipeline_runs(id) on delete cascade,
  brand_profile_id    uuid references brand_profiles(id) on delete set null,
  template_id         uuid references templates(id) on delete set null,
  caption             text,
  hashtags            text[] not null default '{}',
  image_storage_path  text,
  image_url           text,
  status              text not null default 'ready'
                        check (status in ('ready','approved','rejected','published','superseded')),
  approved_by         uuid references users(id) on delete set null,
  approved_at         timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_posts_org_status on generated_posts (organization_id, status);
create index if not exists idx_posts_run on generated_posts (run_id);

-- ============================================================
--  11. generated_carousels  — carousel output
-- ============================================================
create table if not exists generated_carousels (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  topic_id            uuid references content_topics(id) on delete set null,
  run_id              uuid references pipeline_runs(id) on delete cascade,
  brand_profile_id    uuid references brand_profiles(id) on delete set null,
  template_id         uuid references templates(id) on delete set null,
  title               text,
  hook                text,
  caption             text,
  hashtags            text[] not null default '{}',
  cta                 text,
  slides              jsonb not null default '[]'::jsonb,   -- array of slide content + image refs
  slide_count         integer not null default 0,
  status              text not null default 'ready'
                        check (status in ('draft','ready','approved','rejected','published','superseded')),
  approved_by         uuid references users(id) on delete set null,
  approved_at         timestamptz,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_carousels_org_status on generated_carousels (organization_id, status);
create index if not exists idx_carousels_run on generated_carousels (run_id);

-- ============================================================
--  12. generated_assets  — individual assets (rendered slides, AI images, ...)
-- ============================================================
create table if not exists generated_assets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  run_id            uuid references pipeline_runs(id) on delete cascade,
  post_id           uuid references generated_posts(id) on delete cascade,
  carousel_id       uuid references generated_carousels(id) on delete cascade,
  slide_index       integer,
  type              text not null
                      check (type in ('ai_image','render','logo','upload','background')),
  provider          text,
  prompt            text,
  storage_path      text,
  public_url        text,
  width             integer,
  height            integer,
  bytes             bigint,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists idx_assets_org on generated_assets (organization_id);
create index if not exists idx_assets_run on generated_assets (run_id);
create index if not exists idx_assets_carousel on generated_assets (carousel_id, slide_index);

-- ============================================================
--  13. publish_queue  — scheduled publishing jobs (durable)
-- ============================================================
create table if not exists publish_queue (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  topic_id               uuid references content_topics(id) on delete set null,
  post_id                uuid references generated_posts(id) on delete set null,
  carousel_id            uuid references generated_carousels(id) on delete set null,
  instagram_account_id   uuid not null references instagram_accounts(id) on delete cascade,
  post_type              text not null check (post_type in ('single','carousel')),
  caption                text,
  hashtags               text[] not null default '{}',
  media_urls             text[] not null,             -- 1 url for single, N for carousel (in order)
  scheduled_for          timestamptz not null default now(),
  status                 text not null default 'pending'
                           check (status in ('pending','processing','published','failed','cancelled')),
  retry_count            integer not null default 0,
  max_retries            integer not null default 3,
  last_error             text,
  locked_at              timestamptz,
  locked_by              text,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_queue_due
  on publish_queue (status, scheduled_for);
create index if not exists idx_queue_org_due
  on publish_queue (organization_id, status, scheduled_for);

-- ============================================================
--  14. published_posts  — successfully published content
-- ============================================================
create table if not exists published_posts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  queue_id               uuid references publish_queue(id) on delete set null,
  post_id                uuid references generated_posts(id) on delete set null,
  carousel_id            uuid references generated_carousels(id) on delete set null,
  instagram_account_id   uuid references instagram_accounts(id) on delete set null,
  ig_container_id        text,
  ig_media_id            text,
  permalink              text,
  post_type              text,
  caption                text,
  published_at           timestamptz not null default now(),
  status                 text not null default 'published'
                           check (status in ('published','removed')),
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

create index if not exists idx_published_org on published_posts (organization_id);
create index if not exists idx_published_media on published_posts (ig_media_id);

-- ============================================================
--  15. analytics  — performance snapshots per post over time
-- ============================================================
create table if not exists analytics (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id) on delete cascade,
  published_post_id   uuid references published_posts(id) on delete cascade,
  ig_media_id         text,
  views               bigint not null default 0,
  reach               bigint not null default 0,
  likes               bigint not null default 0,
  comments            bigint not null default 0,
  shares              bigint not null default 0,
  saves               bigint not null default 0,
  profile_visits      bigint not null default 0,
  follows_from_post   bigint not null default 0,
  total_interactions  bigint not null default 0,
  snapshot            jsonb not null default '{}'::jsonb,
  collected_at        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists idx_analytics_post on analytics (published_post_id);
create index if not exists idx_analytics_org_collected on analytics (organization_id, collected_at desc);

-- ============================================================
--  16. failed_jobs  — recoverable failures + retry state
-- ============================================================
create table if not exists failed_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  run_id          uuid references pipeline_runs(id) on delete set null,
  job_type        text not null
                    check (job_type in ('pipeline','render','publish','image_gen','analytics')),
  step            text,
  entity_table    text,
  entity_id       uuid,
  error           text not null,
  error_code      text,
  payload         jsonb not null default '{}'::jsonb,
  retry_count     integer not null default 0,
  max_retries     integer not null default 3,
  next_retry_at   timestamptz not null default now(),
  resolved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_failed_open
  on failed_jobs (resolved, next_retry_at) where resolved = false;
create index if not exists idx_failed_org on failed_jobs (organization_id);

-- ============================================================
--  17. usage_logs  — billing / quota tracking
-- ============================================================
create table if not exists usage_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null
                    check (kind in ('llm_call','image_gen','render','publish')),
  provider        text,
  model           text,
  credits_used    numeric(10,4) not null default 0,
  tokens_in       integer,
  tokens_out      integer,
  duration_ms     integer,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_usage_org_created on usage_logs (organization_id, created_at desc);

-- ============================================================
--  18. webhook_events  — inbound webhook log (instagram, wappflow, n8n)
-- ============================================================
create table if not exists webhook_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  source          text not null,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  processed       boolean not null default false,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_webhooks_unprocessed
  on webhook_events (processed, created_at) where processed = false;

-- ============================================================
--  updated_at triggers
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','users','brand_profiles','templates','instagram_accounts',
    'content_calendars','content_topics','pipeline_runs','generated_posts',
    'generated_carousels','publish_queue','failed_jobs'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================
--  dashboard view — one row per organization with rolled-up counters
-- ============================================================
create or replace view v_org_overview as
select
  o.id                                                                       as organization_id,
  o.name,
  o.subscription_tier,
  o.active,
  (select count(*) from instagram_accounts ia where ia.organization_id = o.id and ia.active) as instagram_accounts,
  (select count(*) from content_topics t where t.organization_id = o.id and t.status = 'pending') as pending_topics,
  (select count(*) from generated_carousels c where c.organization_id = o.id and c.status = 'ready') as ready_carousels,
  (select count(*) from publish_queue q where q.organization_id = o.id and q.status = 'pending') as queue_pending,
  (select count(*) from published_posts p where p.organization_id = o.id) as published_total,
  (select coalesce(sum(a.views), 0) from analytics a where a.organization_id = o.id) as total_views
from organizations o;

-- ============================================================
--  Storage buckets are created automatically by the service at startup
--  (ensureBuckets()). To create them manually instead:
--
--    insert into storage.buckets (id, name, public)
--    values ('content-images','content-images', true),
--           ('content-renders','content-renders', true),
--           ('brand-logos',    'brand-logos',    true)
--    on conflict (id) do nothing;
-- ============================================================
