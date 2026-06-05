-- ============================================================
--  Allow 'draft' status on generated_carousels
-- ============================================================
-- The draft-first pipeline (Forge "Draft first — edit before render" toggle and
-- Campaign "Forge the month") inserts carousels with status 'draft' (content
-- generated, slides not yet rendered). The original CHECK constraint omitted
-- 'draft', so EVERY draft insert failed with:
--   new row for relation "generated_carousels" violates check constraint
--   "generated_carousels_status_check"
-- This silently broke forge-the-month and the draft toggle. Add 'draft'.
alter table generated_carousels
  drop constraint if exists generated_carousels_status_check;
alter table generated_carousels
  add constraint generated_carousels_status_check
  check (status in ('draft','ready','approved','rejected','published','superseded'));
