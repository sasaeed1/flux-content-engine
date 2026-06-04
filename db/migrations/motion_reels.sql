-- ============================================================
--  Motion engine — generated cinematic reels (zero-cost ffmpeg MP4s
--  composed from a carousel's rendered slides).
--
--  Apply AFTER db/schema.sql (needs the set_updated_at() function +
--  organizations / generated_carousels / pipeline_runs tables).
--  Idempotent — safe to re-run.
-- ============================================================

create table if not exists generated_reels (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  carousel_id      uuid references generated_carousels(id) on delete set null,
  run_id           uuid references pipeline_runs(id) on delete set null,
  preset_key       text,
  aspect           text not null default 'reel',
  width            int not null,
  height           int not null,
  duration_sec     numeric(6,2),
  fps              int,
  storage_path     text,
  public_url       text,
  bytes            bigint,
  status           text not null default 'ready',
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_generated_reels_org
  on generated_reels (organization_id, created_at desc);
create index if not exists idx_generated_reels_carousel
  on generated_reels (carousel_id);

-- auto-update updated_at (mirrors the shared trigger in schema.sql)
drop trigger if exists trg_generated_reels_updated_at on generated_reels;
create trigger trg_generated_reels_updated_at
  before update on generated_reels
  for each row execute function set_updated_at();
