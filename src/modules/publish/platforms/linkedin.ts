/**
 * LinkedIn publisher — posts images / multi-image carousels via the UGC Posts API.
 *
 * Real flow (per image):
 *   1. registerUpload  POST /v2/assets?action=registerUpload  → asset URN + uploadUrl
 *   2. upload binary   PUT  <uploadUrl>  (the image bytes)
 *   3. create post     POST /v2/ugcPosts  with the asset URN(s)
 *
 * Auth: a member/organization OAuth access token + the author URN
 * (urn:li:person:… or urn:li:organization:…). One-click OAuth needs the app
 * keys (LINKEDIN_CLIENT_ID/SECRET); until then, a token is entered manually.
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

const log = childLogger({ module: 'publish:linkedin' });
const API = 'https://api.linkedin.com';

function authorUrnOf(conn: SocialConnection): string | null {
  const fromMeta = (conn.metadata?.authorUrn as string | undefined) ?? null;
  return fromMeta || conn.externalId || null;
}

async function registerImageUpload(
  token: string,
  authorUrn: string,
): Promise<{ asset: string; uploadUrl: string }> {
  const res = await fetch(`${API}/v2/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-restli-protocol-version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`registerUpload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    value?: {
      asset?: string;
      uploadMechanism?: Record<string, { uploadUrl?: string }>;
    };
  };
  const asset = data.value?.asset;
  const mech = data.value?.uploadMechanism ?? {};
  const uploadUrl = Object.values(mech)[0]?.uploadUrl;
  if (!asset || !uploadUrl) throw new Error('registerUpload: missing asset/uploadUrl');
  return { asset, uploadUrl };
}

async function uploadBinary(uploadUrl: string, token: string, imageUrl: string): Promise<void> {
  const img = await fetch(imageUrl);
  if (!img.ok) throw new Error(`fetch image ${img.status}`);
  const bytes = Buffer.from(await img.arrayBuffer());
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (!up.ok && up.status !== 201) {
    throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 160)}`);
  }
}

export const linkedinPublisher: SocialPublisher = {
  descriptor(): PlatformDescriptor {
    return {
      platform: 'linkedin',
      name: 'LinkedIn',
      tagline: 'Posts + image carousels to a profile or company page',
      supports: { carousel: true, image: true, video: false },
      appConfigured: Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
      connectFields: [
        {
          key: 'accessToken',
          label: 'Access token',
          placeholder: 'AQX…',
          secret: true,
          required: true,
          help: 'OAuth member/organization token with w_member_social.',
        },
        {
          key: 'authorUrn',
          label: 'Author URN',
          placeholder: 'urn:li:person:xxxx  or  urn:li:organization:1234',
          required: true,
          help: 'Whose feed to post to — a person or company page URN.',
        },
        { key: 'displayName', label: 'Display name', placeholder: 'Acme Co. (optional)' },
      ],
      docsHref: 'https://learn.microsoft.com/linkedin/marketing/integrations/community-management/shares/ugc-post-api',
      accent: '#0A66C2',
    };
  },

  async validate(fields: ConnectFields): Promise<ValidateResult> {
    const accessToken = (fields.accessToken ?? '').trim();
    const authorUrn = (fields.authorUrn ?? '').trim();
    if (!accessToken) return { ok: false, error: 'Access token is required.' };
    if (!/^urn:li:(person|organization):/.test(authorUrn)) {
      return { ok: false, error: 'Author URN must look like urn:li:person:… or urn:li:organization:…' };
    }
    // Best-effort identity check (OpenID userinfo). Non-fatal if the token
    // lacks the openid scope — the connection still works for posting.
    let displayName = (fields.displayName ?? '').trim() || undefined;
    try {
      const r = await fetch(`${API}/v2/userinfo`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const u = (await r.json()) as { name?: string };
        if (u.name) displayName = displayName ?? u.name;
      }
    } catch {
      /* ignore — offline / scope-limited token */
    }
    return {
      ok: true,
      accessToken,
      externalId: authorUrn,
      displayName: displayName ?? authorUrn,
      metadata: { authorUrn },
    };
  },

  async publish(conn: SocialConnection, payload: PublishPayload): Promise<PublishOutcome> {
    const base: PublishOutcome = { platform: 'linkedin', connectionId: conn.id, ok: false };
    const token = conn.accessToken;
    const authorUrn = authorUrnOf(conn);
    if (!token || !authorUrn) {
      return { ...base, error: 'LinkedIn connection is missing a token or author URN.' };
    }
    const images = payload.kind === 'video' ? [] : payload.mediaUrls;
    if (images.length === 0) {
      return { ...base, error: 'LinkedIn currently supports image / carousel posts only.' };
    }
    try {
      const media: Array<{ status: string; media: string }> = [];
      for (const url of images.slice(0, 9)) {
        const { asset, uploadUrl } = await registerImageUpload(token, authorUrn);
        await uploadBinary(uploadUrl, token, url);
        media.push({ status: 'READY', media: asset });
      }
      const post = await fetch(`${API}/v2/ugcPosts`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-restli-protocol-version': '2.0.0',
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: composeCaption(payload) },
              shareMediaCategory: 'IMAGE',
              media,
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      });
      if (!post.ok) {
        return { ...base, error: `ugcPosts ${post.status}: ${(await post.text()).slice(0, 180)}` };
      }
      const id = post.headers.get('x-restli-id') ?? ((await post.json()) as { id?: string }).id;
      log.info({ orgId: conn.organizationId, id }, 'LinkedIn post published');
      return {
        ...base,
        ok: true,
        externalPostId: id ?? undefined,
        permalink: id ? `https://www.linkedin.com/feed/update/${id}` : undefined,
      };
    } catch (err) {
      return { ...base, error: err instanceof Error ? err.message : 'LinkedIn publish failed' };
    }
  },
};
