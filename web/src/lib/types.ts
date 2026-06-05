/** Lightweight DTOs mirroring the engine's API responses. */

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  api_key: string;
  subscription_tier: string;
  ai_provider: string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface ThemePreset {
  id: string;
  key: string;
  name: string;
  description: string | null;
  visual_tone: string | null;
  colors: Record<string, string>;
  typography: Record<string, string | number>;
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
  website: string | null;
  voiceKeywords: string[];
  voiceAvoid: string[];
  personality?: {
    aggression: number;
    minimalism: number;
    luxury: number;
    energy: number;
  };
  theme: {
    presetKey: string | null;
    colors: Record<string, string>;
    typography: Record<string, string | number>;
    visualTone: string | null;
  };
}

export interface Template {
  id: string;
  organization_id: string | null;
  name: string;
  key: string;
  type: string;
  slide_count: number | null;
  is_system: boolean;
}

export interface PipelineRun {
  id: string;
  organization_id: string;
  topic_id: string | null;
  type: string;
  status: string;
  current_step: string | null;
  steps_completed: string[];
  started_at: string;
  finished_at: string | null;
  error: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InstagramAccount {
  id: string;
  organization_id: string;
  ig_business_account_id: string;
  username: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlideContent {
  index: number;
  role: 'hook' | 'content' | 'cta' | 'quote';
  layout: string;
  data: Record<string, string | string[] | number>;
  imageUrl?: string;
  storagePath?: string;
}

export interface CarouselRow {
  id: string;
  organization_id: string;
  topic_id: string | null;
  run_id: string | null;
  title: string | null;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  hashtags: string[];
  slides: SlideContent[];
  slide_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReelRow {
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
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FluxSettings {
  generation: { defaultSlideCount: number | null; creativity: number; hashtagCount: number };
  motion: { defaultAspect: 'reel' | 'square' | 'portrait'; defaultPreset: string; kineticByDefault: boolean };
  seo: { optimize: boolean };
  notifications: { onPublish: boolean; onFailure: boolean };
}

// ----- multi-platform publishing -----
export type SocialPlatform = 'instagram' | 'linkedin' | 'tiktok';

export interface PlatformConnectField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface PlatformDescriptor {
  platform: SocialPlatform;
  name: string;
  tagline: string;
  supports: { carousel: boolean; image: boolean; video: boolean };
  appConfigured: boolean;
  connectFields: PlatformConnectField[];
  docsHref?: string;
  accent: string;
}

export interface SocialConnectionPublic {
  id: string;
  platform: SocialPlatform;
  displayName: string | null;
  externalId: string | null;
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  isDefault: boolean;
}

export interface PublishOutcome {
  platform: SocialPlatform;
  connectionId: string;
  ok: boolean;
  externalPostId?: string;
  permalink?: string;
  error?: string;
}

// ----- AI Media Intelligence Studio -----
export interface MediaScores {
  sharpness: number;
  exposure: number;
  contrast: number;
  resolution: number;
  composition: number;
  social: number;
}

export interface MediaAnalysis {
  width: number;
  height: number;
  megapixels: number;
  aspectRatio: number;
  bytes: number;
  format: string;
  brightness: number;
  dominantColor: string;
  scores: MediaScores;
  flags: string[];
}

export interface MediaAsset {
  id: string;
  kind: string;
  filename: string | null;
  source_url: string;
  enhanced_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  analysis: MediaAnalysis;
  overall_score: number | null;
  status: string;
  metadata: {
    enhance_applied?: string[];
    enhanced_at?: string;
    crops?: Record<string, string>;
    backgrounds?: Record<string, string>;
  } | null;
  created_at: string;
}

export interface DirectorVerdict {
  headline: string;
  hero_pick?: string;
  notes: string[];
}

export interface OrgOverview {
  organization_id: string;
  name: string;
  subscription_tier: string;
  active: boolean;
  instagram_accounts: number;
  pending_topics: number;
  ready_carousels: number;
  queue_pending: number;
  published_total: number;
  total_views: number;
}
