/**
 * Multi-platform publishing abstraction.
 *
 * Each social platform (Instagram, LinkedIn, TikTok, …) implements
 * `SocialPublisher`. A registry exposes them uniformly so the UI can list
 * channels and the engine can publish a carousel/reel to any connected account.
 *
 * Credentials live per-org in the `social_connections` table. Platforms are
 * "app-configured" when their OAuth app keys exist in env — but every platform
 * also supports manual token connect, so the whole flow works end-to-end the
 * moment a valid token is provided (only real keys/tokens are pending).
 */
export type SocialPlatform = 'instagram' | 'linkedin' | 'tiktok';

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'linkedin', 'tiktok'];

/** A normalized connected account (mapped from a social_connections row). */
export interface SocialConnection {
  id: string;
  organizationId: string;
  platform: SocialPlatform;
  displayName: string | null;
  externalId: string | null;
  accessToken: string | null;
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  isDefault: boolean;
  metadata: Record<string, unknown>;
}

/** Raw fields the user submits on the connect form (manual-token connect). */
export type ConnectFields = Record<string, string>;

export interface ConnectFieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

/** Static description of a platform — drives the Channels UI. */
export interface PlatformDescriptor {
  platform: SocialPlatform;
  name: string;
  tagline: string;
  supports: { carousel: boolean; image: boolean; video: boolean };
  /**
   * True when the platform's OAuth app keys are present in env. When false,
   * one-click OAuth isn't available yet — but manual token connect still works.
   */
  appConfigured: boolean;
  connectFields: ConnectFieldSpec[];
  docsHref?: string;
  /** Brand accent for the UI chip. */
  accent: string;
}

export interface PublishPayload {
  kind: 'carousel' | 'image' | 'video';
  caption: string;
  hashtags: string[];
  /** Ordered image URLs (carousel/image). */
  mediaUrls: string[];
  /** Video/reel URL (kind: 'video'). */
  videoUrl?: string;
}

export interface PublishOutcome {
  platform: SocialPlatform;
  connectionId: string;
  ok: boolean;
  externalPostId?: string;
  permalink?: string;
  error?: string;
}

export interface ValidateResult {
  ok: boolean;
  displayName?: string;
  externalId?: string;
  accessToken?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface SocialPublisher {
  descriptor(): PlatformDescriptor;
  /** Validate manual-connect fields and return normalized credential bits to store. */
  validate(fields: ConnectFields): Promise<ValidateResult>;
  /** Publish a payload using a stored connection's credentials. */
  publish(conn: SocialConnection, payload: PublishPayload): Promise<PublishOutcome>;
}

/** Compose a caption with hashtags appended (most platforms want them inline). */
export function composeCaption(payload: PublishPayload): string {
  const tags = (payload.hashtags ?? [])
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ');
  return [payload.caption?.trim(), tags].filter(Boolean).join('\n\n');
}
