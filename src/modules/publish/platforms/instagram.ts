/**
 * Instagram publisher — adapts the existing Graph API service to the unified
 * SocialPublisher interface. Credentials are a per-account long-lived token +
 * IG Business Account ID (entered manually, as Meta requires for self-hosted
 * apps). Carousels use publishCarousel; single images use publishSingle.
 */
import { publishCarousel, publishSingle } from '../instagramService';
import type { ResolvedInstagramAccount } from '../../../types';
import { env } from '../../../config/env';
import { childLogger } from '../../../lib/logger';
import type {
  ConnectFields,
  PlatformDescriptor,
  PublishOutcome,
  PublishPayload,
  SocialConnection,
  SocialPublisher,
  ValidateResult,
} from './types';
import { composeCaption } from './types';

const log = childLogger({ module: 'publish:instagram' });

function accountOf(conn: SocialConnection): ResolvedInstagramAccount {
  return {
    id: conn.id,
    organizationId: conn.organizationId,
    igBusinessAccountId: conn.externalId ?? '',
    igAccessToken: conn.accessToken ?? '',
    username: conn.displayName,
  };
}

export const instagramPublisher: SocialPublisher = {
  descriptor(): PlatformDescriptor {
    return {
      platform: 'instagram',
      name: 'Instagram',
      tagline: 'Carousels + single posts to a Business/Creator account',
      supports: { carousel: true, image: true, video: false },
      appConfigured: true, // per-account token model — no app-level env key needed
      connectFields: [
        {
          key: 'externalId',
          label: 'IG Business Account ID',
          placeholder: '17841401234567890',
          required: true,
        },
        {
          key: 'accessToken',
          label: 'Long-lived access token',
          placeholder: 'EAA…',
          secret: true,
          required: true,
        },
        { key: 'displayName', label: 'Username', placeholder: 'your.handle (optional)' },
      ],
      docsHref: '/help#instagram',
      accent: '#E1306C',
    };
  },

  async validate(fields: ConnectFields): Promise<ValidateResult> {
    const externalId = (fields.externalId ?? '').trim();
    const accessToken = (fields.accessToken ?? '').trim();
    if (!externalId || !accessToken) {
      return { ok: false, error: 'Both the IG Business Account ID and access token are required.' };
    }
    let displayName = (fields.displayName ?? '').trim() || undefined;
    try {
      const r = await fetch(
        `https://graph.facebook.com/${env.IG_GRAPH_API_VERSION}/${externalId}?fields=username&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (r.ok) {
        const u = (await r.json()) as { username?: string };
        if (u.username) displayName = displayName ?? u.username;
      }
    } catch {
      /* ignore */
    }
    return { ok: true, externalId, accessToken, displayName: displayName ?? externalId };
  },

  async publish(conn: SocialConnection, payload: PublishPayload): Promise<PublishOutcome> {
    const base: PublishOutcome = { platform: 'instagram', connectionId: conn.id, ok: false };
    if (!conn.accessToken || !conn.externalId) {
      return { ...base, error: 'Instagram connection is missing a token or account ID.' };
    }
    const images = payload.mediaUrls;
    if (images.length === 0) return { ...base, error: 'No images to publish.' };
    try {
      const account = accountOf(conn);
      const caption = composeCaption(payload);
      const res =
        images.length >= 2
          ? await publishCarousel({ account, caption, imageUrls: images.slice(0, 10) })
          : await publishSingle({ account, caption, imageUrl: images[0] });
      log.info({ orgId: conn.organizationId, mediaId: res.mediaId }, 'Instagram published');
      return { ...base, ok: true, externalPostId: res.mediaId, permalink: res.permalink };
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : 'Instagram publish failed' };
    }
  },
};
