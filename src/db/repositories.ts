/**
 * Tenant-aware data-access layer.
 *
 *   - Every business read/write is scoped by `organization_id`.
 *   - Cross-tenant helpers (claimPublishJob, getRetryableJobs, getDueJobs)
 *     are restricted to scheduler/worker code paths.
 *   - The repo wraps Supabase calls and normalises errors to DatabaseError.
 */
import { supabase } from '../lib/supabase';
import { DatabaseError } from '../lib/errors';
import type {
  AnalyticsRow,
  BrandProfileRow,
  ContentCalendarRow,
  ContentTopicRow,
  FailedJobRow,
  GeneratedAssetRow,
  GeneratedCarouselRow,
  GeneratedPostRow,
  InstagramAccountRow,
  Json,
  OrgMembershipRow,
  OrganizationRow,
  PipelineRunRow,
  PublishQueueRow,
  PublishedPostRow,
  TemplateRow,
  ThemePresetRow,
  UsageLogRow,
  UserRow,
  WebhookEventRow,
} from '../types';

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

function unwrap<T>(result: SupabaseResult<T>, action: string): T {
  if (result.error) throw new DatabaseError(`${action}: ${result.error.message}`);
  if (result.data === null) throw new DatabaseError(`${action}: no data returned`);
  return result.data;
}

function unwrapMaybe<T>(result: SupabaseResult<T>, action: string): T | null {
  if (result.error) throw new DatabaseError(`${action}: ${result.error.message}`);
  return result.data;
}

/**
 * Convert camelCase / PascalCase object keys to snake_case for Supabase.
 * The DB schema is snake_case but our TypeScript types and API payloads use
 * camelCase, so every write that takes user input needs this transform.
 * Leaves arrays and primitive values untouched.
 */
function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function snakeKeys<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ============================================================
 *  ORGANIZATIONS
 * ============================================================ */

export async function getOrgById(id: string): Promise<OrganizationRow | null> {
  return unwrapMaybe(
    await supabase.from('organizations').select('*').eq('id', id).maybeSingle(),
    'getOrgById',
  );
}

export async function getOrgByApiKey(apiKey: string): Promise<OrganizationRow | null> {
  return unwrapMaybe(
    await supabase.from('organizations').select('*').eq('api_key', apiKey).maybeSingle(),
    'getOrgByApiKey',
  );
}

export async function getOrgBySlug(slug: string): Promise<OrganizationRow | null> {
  return unwrapMaybe(
    await supabase.from('organizations').select('*').eq('slug', slug).maybeSingle(),
    'getOrgBySlug',
  );
}

export async function createOrg(row: Partial<OrganizationRow>): Promise<OrganizationRow> {
  return unwrap(
    await supabase.from('organizations').insert(row).select('*').single(),
    'createOrg',
  );
}

export async function updateOrg(id: string, patch: Partial<OrganizationRow>): Promise<void> {
  const { error } = await supabase.from('organizations').update(patch).eq('id', id);
  if (error) throw new DatabaseError(`updateOrg: ${error.message}`);
}

/* ============================================================
 *  USERS + MEMBERSHIPS
 * ============================================================ */

export async function getUserById(id: string): Promise<UserRow | null> {
  return unwrapMaybe(
    await supabase.from('users').select('*').eq('id', id).maybeSingle(),
    'getUserById',
  );
}

export async function listMembersByOrg(orgId: string): Promise<OrgMembershipRow[]> {
  return unwrap(
    await supabase.from('org_memberships').select('*').eq('organization_id', orgId),
    'listMembersByOrg',
  );
}

/* ============================================================
 *  THEME PRESETS  (global — no org scope)
 * ============================================================ */

export async function listThemes(): Promise<ThemePresetRow[]> {
  return unwrap(
    await supabase.from('theme_presets').select('*').order('name'),
    'listThemes',
  );
}

export async function getThemeByKey(key: string): Promise<ThemePresetRow | null> {
  return unwrapMaybe(
    await supabase.from('theme_presets').select('*').eq('key', key).maybeSingle(),
    'getThemeByKey',
  );
}

export async function getThemeById(id: string): Promise<ThemePresetRow | null> {
  return unwrapMaybe(
    await supabase.from('theme_presets').select('*').eq('id', id).maybeSingle(),
    'getThemeById',
  );
}

/* ============================================================
 *  BRAND PROFILES
 * ============================================================ */

export async function getBrandById(orgId: string, id: string): Promise<BrandProfileRow | null> {
  return unwrapMaybe(
    await supabase
      .from('brand_profiles')
      .select('*')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle(),
    'getBrandById',
  );
}

export async function getDefaultBrandForOrg(orgId: string): Promise<BrandProfileRow | null> {
  return unwrapMaybe(
    await supabase
      .from('brand_profiles')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .maybeSingle(),
    'getDefaultBrandForOrg',
  );
}

export async function listBrandsForOrg(orgId: string): Promise<BrandProfileRow[]> {
  return unwrap(
    await supabase
      .from('brand_profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at'),
    'listBrandsForOrg',
  );
}

export async function createBrand(row: Partial<BrandProfileRow>): Promise<BrandProfileRow> {
  // Translate camelCase API payload → snake_case DB columns.
  return unwrap(
    await supabase.from('brand_profiles').insert(snakeKeys(row)).select('*').single(),
    'createBrand',
  );
}

export async function updateBrand(
  orgId: string,
  id: string,
  patch: Partial<BrandProfileRow>,
): Promise<void> {
  const { error } = await supabase
    .from('brand_profiles')
    .update(snakeKeys(patch))
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new DatabaseError(`updateBrand: ${error.message}`);
}

/* ============================================================
 *  TEMPLATES (system templates have organization_id = NULL)
 * ============================================================ */

export async function getTemplateById(id: string): Promise<TemplateRow | null> {
  return unwrapMaybe(
    await supabase.from('templates').select('*').eq('id', id).maybeSingle(),
    'getTemplateById',
  );
}

/** Returns an org-custom template by key, else falls back to the system one. */
export async function getTemplateByKey(
  orgId: string,
  key: string,
): Promise<TemplateRow | null> {
  const custom = unwrapMaybe(
    await supabase
      .from('templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('key', key)
      .maybeSingle(),
    'getTemplateByKey:custom',
  );
  if (custom) return custom;
  return unwrapMaybe(
    await supabase
      .from('templates')
      .select('*')
      .is('organization_id', null)
      .eq('key', key)
      .maybeSingle(),
    'getTemplateByKey:system',
  );
}

export async function listTemplatesForOrg(orgId: string): Promise<TemplateRow[]> {
  // org templates + system templates (org_id null)
  return unwrap(
    await supabase
      .from('templates')
      .select('*')
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('is_system', { ascending: false })
      .order('name'),
    'listTemplatesForOrg',
  );
}

/* ============================================================
 *  INSTAGRAM ACCOUNTS
 * ============================================================ */

export async function getInstagramAccountById(
  orgId: string,
  id: string,
): Promise<InstagramAccountRow | null> {
  return unwrapMaybe(
    await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle(),
    'getInstagramAccountById',
  );
}

export async function getDefaultInstagramAccount(
  orgId: string,
): Promise<InstagramAccountRow | null> {
  // is_default first, then any active
  const def = unwrapMaybe(
    await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true)
      .eq('is_default', true)
      .maybeSingle(),
    'getDefaultInstagramAccount:default',
  );
  if (def) return def;
  return unwrapMaybe(
    await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    'getDefaultInstagramAccount:any',
  );
}

export async function listInstagramAccounts(orgId: string): Promise<InstagramAccountRow[]> {
  return unwrap(
    await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at'),
    'listInstagramAccounts',
  );
}

export async function createInstagramAccount(
  row: Partial<InstagramAccountRow>,
): Promise<InstagramAccountRow> {
  return unwrap(
    await supabase.from('instagram_accounts').insert(row).select('*').single(),
    'createInstagramAccount',
  );
}

/* ============================================================
 *  CONTENT CALENDARS
 * ============================================================ */

export async function listCalendarsForOrg(orgId: string): Promise<ContentCalendarRow[]> {
  return unwrap(
    await supabase
      .from('content_calendars')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at'),
    'listCalendarsForOrg',
  );
}

export async function getCalendarById(
  orgId: string,
  id: string,
): Promise<ContentCalendarRow | null> {
  return unwrapMaybe(
    await supabase
      .from('content_calendars')
      .select('*')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle(),
    'getCalendarById',
  );
}

/* ============================================================
 *  CONTENT TOPICS
 * ============================================================ */

export async function getNextPendingTopic(
  orgId: string,
  calendarId?: string,
): Promise<ContentTopicRow | null> {
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from('content_topics')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .lte('scheduled_date', today)
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true })
    .limit(1);
  if (calendarId) q = q.eq('calendar_id', calendarId);
  return unwrapMaybe(await q.maybeSingle(), 'getNextPendingTopic');
}

export async function getTopicById(
  orgId: string,
  id: string,
): Promise<ContentTopicRow | null> {
  return unwrapMaybe(
    await supabase
      .from('content_topics')
      .select('*')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle(),
    'getTopicById',
  );
}

export async function updateTopic(
  orgId: string,
  id: string,
  patch: Partial<ContentTopicRow>,
): Promise<void> {
  const { error } = await supabase
    .from('content_topics')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new DatabaseError(`updateTopic: ${error.message}`);
}

export async function insertTopics(
  rows: Array<Partial<ContentTopicRow>>,
): Promise<ContentTopicRow[]> {
  return unwrap(
    await supabase.from('content_topics').insert(rows).select('*'),
    'insertTopics',
  );
}

/* ============================================================
 *  PIPELINE RUNS
 * ============================================================ */

export async function createRun(input: {
  organization_id: string;
  topic_id?: string | null;
  type?: 'single' | 'carousel' | 'batch';
  metadata?: Json;
}): Promise<PipelineRunRow> {
  return unwrap(
    await supabase
      .from('pipeline_runs')
      .insert({
        organization_id: input.organization_id,
        topic_id: input.topic_id ?? null,
        type: input.type ?? 'carousel',
        status: 'running',
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single(),
    'createRun',
  );
}

export async function updateRun(id: string, patch: Partial<PipelineRunRow>): Promise<void> {
  const { error } = await supabase.from('pipeline_runs').update(patch).eq('id', id);
  if (error) throw new DatabaseError(`updateRun: ${error.message}`);
}

export async function getRun(id: string): Promise<PipelineRunRow | null> {
  return unwrapMaybe(
    await supabase.from('pipeline_runs').select('*').eq('id', id).maybeSingle(),
    'getRun',
  );
}

/* ============================================================
 *  GENERATED POSTS + CAROUSELS
 * ============================================================ */

export async function insertPost(row: Partial<GeneratedPostRow>): Promise<GeneratedPostRow> {
  return unwrap(
    await supabase.from('generated_posts').insert(row).select('*').single(),
    'insertPost',
  );
}

export async function updatePost(
  orgId: string,
  id: string,
  patch: Partial<GeneratedPostRow>,
): Promise<void> {
  const { error } = await supabase
    .from('generated_posts')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new DatabaseError(`updatePost: ${error.message}`);
}

export async function insertCarousel(
  row: Partial<GeneratedCarouselRow>,
): Promise<GeneratedCarouselRow> {
  return unwrap(
    await supabase.from('generated_carousels').insert(row).select('*').single(),
    'insertCarousel',
  );
}

export async function listCarouselsForOrg(
  orgId: string,
  opts: { limit?: number; status?: string } = {},
): Promise<GeneratedCarouselRow[]> {
  let q = supabase
    .from('generated_carousels')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.status) q = q.eq('status', opts.status);
  return unwrap(await q, 'listCarouselsForOrg');
}

export async function getCarouselByIdScoped(
  orgId: string,
  id: string,
): Promise<GeneratedCarouselRow | null> {
  return unwrapMaybe(
    await supabase
      .from('generated_carousels')
      .select('*')
      .eq('organization_id', orgId)
      .eq('id', id)
      .maybeSingle(),
    'getCarouselByIdScoped',
  );
}

export async function listPipelineRunsForOrg(
  orgId: string,
  limit = 20,
): Promise<PipelineRunRow[]> {
  return unwrap(
    await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(limit),
    'listPipelineRunsForOrg',
  );
}

export async function getOrgOverview(orgId: string): Promise<Record<string, unknown> | null> {
  return unwrapMaybe(
    await supabase.from('v_org_overview').select('*').eq('organization_id', orgId).maybeSingle(),
    'getOrgOverview',
  );
}

export async function updateCarousel(
  orgId: string,
  id: string,
  patch: Partial<GeneratedCarouselRow>,
): Promise<void> {
  const { error } = await supabase
    .from('generated_carousels')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new DatabaseError(`updateCarousel: ${error.message}`);
}

/* ============================================================
 *  GENERATED ASSETS
 * ============================================================ */

export async function insertAsset(
  row: Partial<GeneratedAssetRow>,
): Promise<GeneratedAssetRow> {
  return unwrap(
    await supabase.from('generated_assets').insert(row).select('*').single(),
    'insertAsset',
  );
}

/* ============================================================
 *  PUBLISH QUEUE  (cross-tenant in worker paths)
 * ============================================================ */

export async function enqueuePublish(
  row: Partial<PublishQueueRow>,
): Promise<PublishQueueRow> {
  return unwrap(
    await supabase.from('publish_queue').insert(row).select('*').single(),
    'enqueuePublish',
  );
}

export async function getDuePublishJobs(limit = 10): Promise<PublishQueueRow[]> {
  return unwrap(
    await supabase
      .from('publish_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso())
      .order('scheduled_for', { ascending: true })
      .limit(limit),
    'getDuePublishJobs',
  );
}

export async function claimPublishJob(
  id: string,
  workerId: string,
): Promise<PublishQueueRow | null> {
  return unwrapMaybe(
    await supabase
      .from('publish_queue')
      .update({ status: 'processing', locked_at: nowIso(), locked_by: workerId })
      .eq('id', id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle(),
    'claimPublishJob',
  );
}

export async function updatePublishJob(
  id: string,
  patch: Partial<PublishQueueRow>,
): Promise<void> {
  const { error } = await supabase.from('publish_queue').update(patch).eq('id', id);
  if (error) throw new DatabaseError(`updatePublishJob: ${error.message}`);
}

/* ============================================================
 *  PUBLISHED POSTS
 * ============================================================ */

export async function insertPublishedPost(
  row: Partial<PublishedPostRow>,
): Promise<PublishedPostRow> {
  return unwrap(
    await supabase.from('published_posts').insert(row).select('*').single(),
    'insertPublishedPost',
  );
}

export async function getRecentPublishedPosts(sinceHours = 96): Promise<PublishedPostRow[]> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  return unwrap(
    await supabase
      .from('published_posts')
      .select('*')
      .eq('status', 'published')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(100),
    'getRecentPublishedPosts',
  );
}

/* ============================================================
 *  ANALYTICS
 * ============================================================ */

export async function insertAnalytics(
  row: Partial<AnalyticsRow>,
): Promise<AnalyticsRow> {
  return unwrap(
    await supabase.from('analytics').insert(row).select('*').single(),
    'insertAnalytics',
  );
}

/* ============================================================
 *  FAILED JOBS  (recovery)
 * ============================================================ */

export interface FailedJobInput {
  organization_id?: string | null;
  run_id?: string | null;
  job_type: FailedJobRow['job_type'];
  step?: string | null;
  entity_table?: string | null;
  entity_id?: string | null;
  error: string;
  error_code?: string | null;
  payload?: Json;
  max_retries?: number;
  next_retry_at?: string;
}

export async function insertFailedJob(input: FailedJobInput): Promise<FailedJobRow> {
  return unwrap(
    await supabase
      .from('failed_jobs')
      .insert({
        organization_id: input.organization_id ?? null,
        run_id: input.run_id ?? null,
        job_type: input.job_type,
        step: input.step ?? null,
        entity_table: input.entity_table ?? null,
        entity_id: input.entity_id ?? null,
        error: input.error,
        error_code: input.error_code ?? null,
        payload: input.payload ?? {},
        max_retries: input.max_retries ?? 3,
        next_retry_at: input.next_retry_at ?? nowIso(),
      })
      .select('*')
      .single(),
    'insertFailedJob',
  );
}

export async function getRetryableJobs(limit = 10): Promise<FailedJobRow[]> {
  const rows = unwrap(
    await supabase
      .from('failed_jobs')
      .select('*')
      .eq('resolved', false)
      .lte('next_retry_at', nowIso())
      .order('next_retry_at', { ascending: true })
      .limit(limit * 3),
    'getRetryableJobs',
  );
  return rows.filter((j) => j.retry_count < j.max_retries).slice(0, limit);
}

export async function updateFailedJob(
  id: string,
  patch: Partial<FailedJobRow>,
): Promise<void> {
  const { error } = await supabase.from('failed_jobs').update(patch).eq('id', id);
  if (error) throw new DatabaseError(`updateFailedJob: ${error.message}`);
}

/* ============================================================
 *  USAGE LOGS  (billing / quotas)
 * ============================================================ */

export async function insertUsage(
  row: Partial<UsageLogRow>,
): Promise<UsageLogRow> {
  return unwrap(
    await supabase.from('usage_logs').insert(row).select('*').single(),
    'insertUsage',
  );
}

/* ============================================================
 *  WEBHOOK EVENTS
 * ============================================================ */

export async function insertWebhookEvent(
  row: Partial<WebhookEventRow>,
): Promise<WebhookEventRow> {
  return unwrap(
    await supabase.from('webhook_events').insert(row).select('*').single(),
    'insertWebhookEvent',
  );
}

export async function markWebhookProcessed(id: string, error?: string): Promise<void> {
  const { error: dbErr } = await supabase
    .from('webhook_events')
    .update({ processed: true, error: error ?? null })
    .eq('id', id);
  if (dbErr) throw new DatabaseError(`markWebhookProcessed: ${dbErr.message}`);
}
