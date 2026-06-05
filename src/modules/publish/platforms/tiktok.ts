/**
 * TikTok publisher — Content Posting API (Direct Post).
 *
 *   video:    POST /v2/post/publish/video/init/    (source PULL_FROM_URL)
 *   photo:    POST /v2/post/publish/content/init/  (media_type PHOTO)
 *   status:   POST /v2/post/publish/status/fetch/  { publish_id }
 *
 * Auth: a user OAuth access token. One-click OAuth needs the app keys
 * (TIKTOK_CLIENT_KEY/SECRET) AND a TikTok-verified domain for PULL_FROM_URL;
 * until then a token is entered manually. Structure is production-faithful —
 * only real keys + domain verification are pending.
 */
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

const log = childLogger({ module: 'publish:tiktok' });
const API = 'https://open.tiktokapis.com';

async function tiktokPost(
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data?: { publish_id?: string }; error?: string }> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };
  const errCode = json.error?.code;
  const ok = res.ok && (!errCode || errCode === 'ok');
  return {
    ok,
    status: res.status,
    data: json.data,
    error: ok ? undefined : `${errCode ?? res.status}: ${json.error?.message ?? ''}`.trim(),
  };
}

export const tiktokPublisher: SocialPublisher = {
  descriptor(): PlatformDescriptor {
    return {
      platform: 'tiktok',
      name: 'TikTok',
      tagline: 'Cinematic reels + photo posts via Direct Post',
      supports: { carousel: true, image: true, video: true },
      appConfigured: Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
      connectFields: [
        {
          key: 'accessToken',
          label: 'Access token',
          placeholder: 'act.…',
          secret: true,
          required: true,
          help: 'User OAuth token with video.publish / video.upload scope.',
        },
        { key: 'displayName', label: 'Display name', placeholder: '@yourhandle (optional)' },
      ],
      docsHref: 'https://developers.tiktok.com/doc/content-posting-api-reference-direct-post',
      accent: '#FE2C55',
    };
  },

  async validate(fields: ConnectFields): Promise<ValidateResult> {
    const accessToken = (fields.accessToken ?? '').trim();
    if (!accessToken) return { ok: false, error: 'Access token is required.' };
    let displayName = (fields.displayName ?? '').trim() || undefined;
    let externalId: string | undefined;
    // Best-effort identity (creator info). Non-fatal.
    try {
      const r = await fetch(`${API}/v2/user/info/?fields=open_id,display_name`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const u = (await r.json()) as { data?: { user?: { display_name?: string; open_id?: string } } };
        displayName = displayName ?? u.data?.user?.display_name;
        externalId = u.data?.user?.open_id;
      }
    } catch {
      /* ignore */
    }
    return { ok: true, accessToken, displayName: displayName ?? 'TikTok account', externalId };
  },

  async publish(conn: SocialConnection, payload: PublishPayload): Promise<PublishOutcome> {
    const base: PublishOutcome = { platform: 'tiktok', connectionId: conn.id, ok: false };
    const token = conn.accessToken;
    if (!token) return { ...base, error: 'TikTok connection is missing a token.' };
    const title = composeCaption(payload).slice(0, 2200);

    try {
      let result;
      if (payload.kind === 'video' && payload.videoUrl) {
        result = await tiktokPost('/v2/post/publish/video/init/', token, {
          post_info: { title, privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'PULL_FROM_URL', video_url: payload.videoUrl },
        });
      } else {
        const images = payload.mediaUrls.slice(0, 35);
        if (images.length === 0) return { ...base, error: 'No media to publish.' };
        result = await tiktokPost('/v2/post/publish/content/init/', token, {
          post_info: { title, privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'PULL_FROM_URL', photo_images: images, photo_cover_index: 0 },
          post_mode: 'DIRECT_POST',
          media_type: 'PHOTO',
        });
      }
      if (!result.ok) return { ...base, error: `TikTok: ${result.error}` };
      const publishId = result.data?.publish_id;
      log.info({ orgId: conn.organizationId, publishId }, 'TikTok publish initiated');
      // Direct Post is async on TikTok's side; the publish_id is the handle.
      return { ...base, ok: true, externalPostId: publishId };
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : 'TikTok publish failed' };
    }
  },
};
