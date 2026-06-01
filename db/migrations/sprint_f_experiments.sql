-- ============================================================================
--  Sprint F — A/B testing infrastructure.
--
--  Apply this in the Supabase SQL editor (Dashboard → SQL → New query → Run),
--  or via any psql connection to the project DB. Idempotent.
--
--  Once applied, the engine's experiment chooser + winner-detection wiring
--  (already coded behind a table-exists probe) activates automatically — no
--  redeploy needed beyond the one that ships the code.
-- ============================================================================

create table if not exists experiments (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references organizations(id) on delete cascade,
  name              text        not null,
  -- which content dimension is being tested
  dimension         text        not null
                      check (dimension in ('hook_archetype','style_mode_key','cta_style')),
  -- the candidate values being compared (e.g. ['curiosity','contrarian','fear'])
  variants          text[]      not null default '{}',
  status            text        not null default 'running'
                      check (status in ('running','complete','archived')),
  -- minimum carousels per variant before a winner can be declared
  min_samples       int         not null default 3,
  winner            text,
  created_at        timestamptz not null default now(),
  decided_at        timestamptz
);

create index if not exists idx_experiments_org_status
  on experiments (organization_id, status, created_at desc);

create unique index if not exists idx_experiments_one_active_per_dim
  on experiments (organization_id, dimension)
  where status = 'running';
