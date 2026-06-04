/**
 * Shared types.
 *  - "Domain" types model the data flowing through the pipeline.
 *  - "Row" types mirror Supabase tables (snake_case columns).
 * Every business type carries `organizationId` — tenancy is non-optional.
 */

/* ============================================================
 *  TENANT CONTEXT (request-scoped)
 * ============================================================ */

export interface TenantContext {
  organizationId: string;
  apiKey: string;
  subscriptionTier: string;
  aiProvider: LlmProvider | null;     // per-org override
  aiProviderKey: string | null;       // per-org override
}

/* ============================================================
 *  DOMAIN TYPES
 * ============================================================ */

export type LlmProvider = 'groq' | 'openai' | 'ollama';
export type ImageProvider = 'none' | 'openai' | 'comfyui' | 'fal';

export interface BrandTheme {
  /** Theme preset key the brand is based on (e.g. "minimal-startup"). */
  presetKey: string | null;
  colors: BrandColors;
  typography: BrandTypography;
  visualTone: string | null;
  effects: Record<string, unknown>;
}

export interface BrandColors {
  background: string;
  foreground: string;
  muted?: string;
  accent: string;
  accentSoft?: string;
  gradientFrom?: string;
  gradientTo?: string;
  glow?: string;
  [extra: string]: string | undefined;
}

export interface BrandTypography {
  fontPrimary: string;
  fontDisplay: string;
  weightDisplay?: number;
  weightBody?: number;
  sizeHook?: number;       // px at 1080-wide canvas
  sizeBody?: number;
  [extra: string]: string | number | undefined;
}

export interface BrandProfile {
  id: string;
  organizationId: string;
  name: string;
  niche: string | null;
  businessType: string | null;
  tone: string | null;
  postStyle: string | null;
  ctaStyle: string | null;
  logoUrl: string | null;
  voiceKeywords: string[];
  voiceAvoid: string[];
  theme: BrandTheme;
}

export type PostType =
  | 'single'
  | 'carousel'
  | 'quote'
  | 'cta'
  | 'announcement'
  | 'lead_magnet'
  | 'promotional'
  | 'educational';

export interface SlideDefinition {
  role: 'hook' | 'content' | 'cta' | 'quote';
  layout: string;             // template-specific layout key
  slots: string[];
}

export interface TemplateDefinition {
  kind: 'single' | 'carousel';
  slides: SlideDefinition[];
  renderer: 'html-puppeteer';
  htmlTemplate: string;       // key into render/templates/
  defaults?: Record<string, unknown>;
}

export interface Template {
  id: string;
  organizationId: string | null;
  name: string;
  key: string;
  type: PostType;
  slideCount: number | null;
  definition: TemplateDefinition;
  isSystem: boolean;
}

export interface SlideContent {
  index: number;
  role: 'hook' | 'content' | 'cta' | 'quote';
  layout: string;
  /** Free-form fields keyed by the layout's slot names (title, body, number, items, etc.). */
  data: Record<string, string | string[] | number>;
}

export interface CarouselContent {
  title: string;
  hook: string;
  cta: string;
  caption: string;
  hashtags: string[];
  slides: SlideContent[];
}

export interface SinglePostContent {
  title: string;
  body: string;
  cta: string;
  caption: string;
  hashtags: string[];
  layout: string;
  data: Record<string, string | string[] | number>;
}

export interface RenderedSlide {
  slideIndex: number;
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ImageGenRequest {
  prompt: string;
  width: number;
  height: number;
  /** Caller-provided seed/style for reproducibility. */
  seed?: number;
  brandColors?: BrandColors;
}

export interface ImageGenResult {
  buffer: Buffer;
  width: number;
  height: number;
  provider: string;
}

export interface ResolvedInstagramAccount {
  id: string;
  organizationId: string;
  igBusinessAccountId: string;
  igAccessToken: string;
  username: string | null;
}

export interface PublishCarouselInput {
  account: ResolvedInstagramAccount;
  caption: string;
  imageUrls: string[];     // 2..10 image URLs in order
}

export interface PublishSingleInput {
  account: ResolvedInstagramAccount;
  caption: string;
  imageUrl: string;
}

export interface PublishResult {
  containerId: string;
  mediaId: string;
  permalink?: string;
}

export interface PipelineOptions {
  organizationId: string;
  topicId?: string;
  brandProfileId?: string;
  templateKey?: string;
  postType?: PostType;
  /** Carousel slide count (3-10) — overrides the template's default. */
  slideCount?: number;
  publishAt?: string;
  approvalMode?: 'auto' | 'manual';
  /** Optional style mode key from `style_modes.key` — Studio passes this through. */
  styleModeKey?: string;
  suppressFailureLog?: boolean;
  /**
   * Sprint D — draft-first generation. When true, the pipeline generates and
   * persists the slide SCRIPT (status='draft') then stops BEFORE rendering, so
   * the user can edit each slide's text in the Forge and render on command.
   */
  draftOnly?: boolean;
}

export interface PipelineResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'pending_approval';
  organizationId: string;
  topicId?: string;
  carouselId?: string;
  postId?: string;
  publishQueueId?: string;
  imageUrls?: string[];
  error?: string;
}

/* ============================================================
 *  DATABASE ROW TYPES
 * ============================================================ */

export type Json = Record<string, unknown>;

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string | null;
  api_key: string;
  ai_provider: LlmProvider | null;
  ai_provider_key: string | null;
  subscription_tier: string;
  credits_balance: number;
  monthly_credits_used: number;
  active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface OrgMembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface ThemePresetRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  colors: Json;
  typography: Json;
  effects: Json;
  visual_tone: string | null;
  metadata: Json;
  created_at: string;
}

export interface BrandProfileRow {
  id: string;
  organization_id: string;
  name: string;
  theme_preset_id: string | null;
  niche: string | null;
  business_type: string | null;
  tone: string | null;
  post_style: string | null;
  cta_style: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  colors: Json;
  typography: Json;
  voice_keywords: string[];
  voice_avoid: string[];
  is_default: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface TemplateRow {
  id: string;
  organization_id: string | null;
  name: string;
  key: string;
  type: PostType;
  slide_count: number | null;
  definition: unknown;
  preview_url: string | null;
  is_system: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface InstagramAccountRow {
  id: string;
  organization_id: string;
  ig_business_account_id: string;
  ig_access_token: string;
  token_expires_at: string | null;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  active: boolean;
  is_default: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ContentCalendarRow {
  id: string;
  organization_id: string;
  name: string;
  brand_profile_id: string | null;
  instagram_account_id: string | null;
  default_template_id: string | null;
  niche: string | null;
  posting_frequency: string;
  post_time_local: string;
  timezone: string;
  approval_mode: 'auto' | 'manual';
  topic_source: 'manual' | 'ai' | 'both';
  active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ContentTopicRow {
  id: string;
  organization_id: string;
  calendar_id: string | null;
  topic: string;
  angle: string | null;
  post_type: PostType;
  scheduled_date: string;
  priority: number;
  status: string;
  source: string;
  attempts: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface PipelineRunRow {
  id: string;
  organization_id: string;
  topic_id: string | null;
  type: 'single' | 'carousel' | 'batch';
  status: string;
  current_step: string | null;
  steps_completed: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface GeneratedPostRow {
  id: string;
  organization_id: string;
  topic_id: string | null;
  run_id: string | null;
  brand_profile_id: string | null;
  template_id: string | null;
  caption: string | null;
  hashtags: string[];
  image_storage_path: string | null;
  image_url: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface GeneratedCarouselRow {
  id: string;
  organization_id: string;
  topic_id: string | null;
  run_id: string | null;
  brand_profile_id: string | null;
  template_id: string | null;
  title: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  cta: string | null;
  slides: unknown;
  slide_count: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface GeneratedAssetRow {
  id: string;
  organization_id: string;
  run_id: string | null;
  post_id: string | null;
  carousel_id: string | null;
  slide_index: number | null;
  type: 'ai_image' | 'render' | 'logo' | 'upload' | 'background';
  provider: string | null;
  prompt: string | null;
  storage_path: string | null;
  public_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  metadata: Json;
  created_at: string;
}

export interface GeneratedReelRow {
  id: string;
  organization_id: string;
  carousel_id: string | null;
  run_id: string | null;
  preset_key: string | null;
  aspect: string;
  width: number;
  height: number;
  duration_sec: number | null;
  fps: number | null;
  storage_path: string | null;
  public_url: string | null;
  bytes: number | null;
  status: string;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface PublishQueueRow {
  id: string;
  organization_id: string;
  topic_id: string | null;
  post_id: string | null;
  carousel_id: string | null;
  instagram_account_id: string;
  post_type: 'single' | 'carousel';
  caption: string | null;
  hashtags: string[];
  media_urls: string[];
  scheduled_for: string;
  status: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface PublishedPostRow {
  id: string;
  organization_id: string;
  queue_id: string | null;
  post_id: string | null;
  carousel_id: string | null;
  instagram_account_id: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  permalink: string | null;
  post_type: string | null;
  caption: string | null;
  published_at: string;
  status: string;
  metadata: Json;
  created_at: string;
}

export interface AnalyticsRow {
  id: string;
  organization_id: string;
  published_post_id: string | null;
  ig_media_id: string | null;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  profile_visits: number;
  follows_from_post: number;
  total_interactions: number;
  snapshot: Json;
  collected_at: string;
  created_at: string;
}

export interface FailedJobRow {
  id: string;
  organization_id: string | null;
  run_id: string | null;
  job_type: 'pipeline' | 'render' | 'publish' | 'image_gen' | 'analytics';
  step: string | null;
  entity_table: string | null;
  entity_id: string | null;
  error: string;
  error_code: string | null;
  payload: Json;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageLogRow {
  id: string;
  organization_id: string;
  kind: 'llm_call' | 'image_gen' | 'render' | 'publish';
  provider: string | null;
  model: string | null;
  credits_used: number;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  metadata: Json;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  organization_id: string | null;
  source: string;
  event_type: string;
  payload: Json;
  processed: boolean;
  error: string | null;
  created_at: string;
}
