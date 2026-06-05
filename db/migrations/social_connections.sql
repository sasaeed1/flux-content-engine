-- ============================================================
--  Multi-platform publishing — connected social accounts
-- ============================================================
-- One row per connected account (Instagram / LinkedIn / TikTok / …). Credentials
-- live here per-org (encrypt at rest in prod). The publisher registry routes a
-- carousel/reel to any combination of these via /tenant/carousels/:id/publish-to.
create table if not exists social_connections (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  platform          text not null check (platform in ('instagram','linkedin','tiktok')),
  display_name      text,
  external_id       text,                -- platform account/page/author id or URN
  access_token      text,                -- encrypt at rest in prod
  refresh_token     text,
  token_expires_at  timestamptz,
  status            text not null default 'connected'
                      check (status in ('connected','expired','error','disconnected')),
  is_default        boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_social_conn_org on social_connections (organization_id, platform);

drop trigger if exists trg_social_connections_updated_at on social_connections;
create trigger trg_social_connections_updated_at
  before update on social_connections
  for each row execute function set_updated_at();
