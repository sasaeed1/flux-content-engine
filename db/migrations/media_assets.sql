-- ============================================================
--  AI Media Intelligence Studio — analyzed media assets (Phase 1, images)
-- ============================================================
-- Each uploaded image is analyzed (quality scores via sharp), ranked by
-- overall_score, and can be enhanced. Foundation for the broader media studio.
create table if not exists media_assets (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  kind              text not null default 'image' check (kind in ('image','video')),
  filename          text,
  source_url        text not null,                 -- original uploaded asset
  enhanced_url      text,                          -- enhanced output (after enhance)
  width             integer,
  height            integer,
  bytes             bigint,
  analysis          jsonb not null default '{}'::jsonb,   -- quality scores + understanding
  overall_score     numeric,                       -- 0..100 ranking score
  status            text not null default 'analyzed'
                      check (status in ('uploaded','analyzed','enhanced','failed')),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_media_org_score on media_assets (organization_id, overall_score desc);

drop trigger if exists trg_media_assets_updated_at on media_assets;
create trigger trg_media_assets_updated_at
  before update on media_assets
  for each row execute function set_updated_at();
