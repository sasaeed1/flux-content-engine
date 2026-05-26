/**
 * Instagram Publishing — Instagram Graph API for single posts AND carousels.
 *
 * Carousel publishing flow (Graph API):
 *   1. For each image, create a CHILD container
 *        POST /{ig-user-id}/media
 *          media_type=IMAGE  is_carousel_item=true  image_url=...
 *      Returns a container id.
 *   2. Create the carousel CONTAINER referencing the children
 *        POST /{ig-user-id}/media
 *          media_type=CAROUSEL  caption=...  children=<csv-of-child-ids>
 *   3. Poll the carousel container until status_code=FINISHED.
 *   4. Publish
 *        POST /{ig-user-id}/media_publish  creation_id=<carousel-id>
 *
 * Single post: a normal IMAGE container (no is_carousel_item), then publish.
 */
import { createHttpClient, describeAxiosError } from '../../lib/http';
import { withRetry, sleep } from '../../lib/retry';
import { env } from '../../config/env';
import { ExternalApiError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import type {
  PublishCarouselInput,
  PublishResult,
  PublishSingleInput,
  ResolvedInstagramAccount,
} from '../../types';

const log = childLogger({ module: 'instagram' });

function graphClient() {
  return createHttpClient({
    baseURL: `https://graph.facebook.com/${env.IG_GRAPH_API_VERSION}`,
    timeout: 60_000,
  });
}

type Graph = ReturnType<typeof graphClient>;

/* ---------- step 1: media containers ---------- */

async function createImageContainer(
  http: Graph,
  account: ResolvedInstagramAccount,
  imageUrl: string,
  isCarouselItem: boolean,
  caption?: string,
): Promise<string> {
  const data = await withRetry(
    async () => {
      const params: Record<string, string | boolean> = {
        media_type: 'IMAGE',
        image_url: imageUrl,
        access_token: account.igAccessToken,
      };
      if (isCarouselItem) params.is_carousel_item = true;
      if (caption && !isCarouselItem) params.caption = caption;
      const res = await http.post<{ id: string }>(
        `/${account.igBusinessAccountId}/media`,
        null,
        { params },
      );
      return res.data;
    },
    { label: 'instagram:create-image-container' },
  ).catch((err) => {
    throw new ExternalApiError('instagram', `createImageContainer: ${describeAxiosError(err)}`, {
      retryable: false,
    });
  });
  if (!data.id) throw new ExternalApiError('instagram', 'createImageContainer returned no id');
  return data.id;
}

async function createCarouselContainer(
  http: Graph,
  account: ResolvedInstagramAccount,
  childIds: string[],
  caption: string,
): Promise<string> {
  const data = await withRetry(
    async () => {
      const res = await http.post<{ id: string }>(
        `/${account.igBusinessAccountId}/media`,
        null,
        {
          params: {
            media_type: 'CAROUSEL',
            caption,
            children: childIds.join(','),
            access_token: account.igAccessToken,
          },
        },
      );
      return res.data;
    },
    { label: 'instagram:create-carousel-container' },
  ).catch((err) => {
    throw new ExternalApiError('instagram', `createCarouselContainer: ${describeAxiosError(err)}`, {
      retryable: false,
    });
  });
  if (!data.id) throw new ExternalApiError('instagram', 'createCarouselContainer returned no id');
  return data.id;
}

/* ---------- step 2: poll container ---------- */

async function waitForContainer(
  http: Graph,
  account: ResolvedInstagramAccount,
  containerId: string,
): Promise<void> {
  const deadline = Date.now() + env.PUBLISH_POLL_TIMEOUT_SEC * 1000;
  for (;;) {
    if (Date.now() > deadline) {
      throw new ExternalApiError(
        'instagram',
        `container ${containerId} processing timed out`,
        { retryable: false },
      );
    }
    await sleep(5000);

    const data = await withRetry(
      async () => {
        const res = await http.get<{ status_code: string; status?: string }>(`/${containerId}`, {
          params: { fields: 'status_code,status', access_token: account.igAccessToken },
        });
        return res.data;
      },
      { label: 'instagram:poll' },
    ).catch((err) => {
      throw new ExternalApiError('instagram', `pollContainer: ${describeAxiosError(err)}`, {
        retryable: false,
      });
    });

    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new ExternalApiError(
        'instagram',
        `container ${containerId} failed: ${data.status ?? data.status_code}`,
        { retryable: false },
      );
    }
    log.debug({ containerId, status: data.status_code }, 'Container processing');
  }
}

/* ---------- step 3: publish ---------- */

async function publishContainer(
  http: Graph,
  account: ResolvedInstagramAccount,
  containerId: string,
): Promise<string> {
  const data = await withRetry(
    async () => {
      const res = await http.post<{ id: string }>(
        `/${account.igBusinessAccountId}/media_publish`,
        null,
        { params: { creation_id: containerId, access_token: account.igAccessToken } },
      );
      return res.data;
    },
    { label: 'instagram:publish' },
  ).catch((err) => {
    throw new ExternalApiError('instagram', `publishContainer: ${describeAxiosError(err)}`, {
      retryable: false,
    });
  });
  if (!data.id) throw new ExternalApiError('instagram', 'media_publish returned no id');
  return data.id;
}

async function fetchPermalink(
  http: Graph,
  account: ResolvedInstagramAccount,
  mediaId: string,
): Promise<string | undefined> {
  try {
    const res = await http.get<{ permalink?: string }>(`/${mediaId}`, {
      params: { fields: 'permalink', access_token: account.igAccessToken },
    });
    return res.data.permalink;
  } catch (err) {
    log.warn({ mediaId, error: describeAxiosError(err) }, 'Could not fetch permalink');
    return undefined;
  }
}

/* ---------- public API ---------- */

export async function publishCarousel(input: PublishCarouselInput): Promise<PublishResult> {
  if (input.imageUrls.length < 2 || input.imageUrls.length > 10) {
    throw new ExternalApiError(
      'instagram',
      `carousel needs 2-10 images (got ${input.imageUrls.length})`,
      { retryable: false },
    );
  }
  const http = graphClient();
  log.info({ account: input.account.username, slides: input.imageUrls.length }, 'Publishing carousel');

  // Build child containers serially to ease rate limits + clearer errors.
  const childIds: string[] = [];
  for (const url of input.imageUrls) {
    childIds.push(await createImageContainer(http, input.account, url, true));
  }
  const carouselId = await createCarouselContainer(http, input.account, childIds, input.caption);
  await waitForContainer(http, input.account, carouselId);
  const mediaId = await publishContainer(http, input.account, carouselId);
  const permalink = await fetchPermalink(http, input.account, mediaId);

  log.info({ mediaId, permalink }, 'Carousel published');
  return { containerId: carouselId, mediaId, permalink };
}

export async function publishSingle(input: PublishSingleInput): Promise<PublishResult> {
  const http = graphClient();
  log.info({ account: input.account.username }, 'Publishing single image');

  const containerId = await createImageContainer(
    http,
    input.account,
    input.imageUrl,
    false,
    input.caption,
  );
  await waitForContainer(http, input.account, containerId);
  const mediaId = await publishContainer(http, input.account, containerId);
  const permalink = await fetchPermalink(http, input.account, mediaId);

  log.info({ mediaId, permalink }, 'Single post published');
  return { containerId, mediaId, permalink };
}

/* ---------- insights ---------- */

export async function fetchMediaInsights(
  account: ResolvedInstagramAccount,
  mediaId: string,
): Promise<Record<string, number>> {
  const http = graphClient();
  const metricSets = [
    'views,reach,likes,comments,saved,shares,total_interactions,profile_visits,follows',
    'reach,likes,comments,saved',
  ];

  for (const metric of metricSets) {
    try {
      const res = await http.get<{ data: Array<{ name: string; values?: Array<{ value: number }> }> }>(
        `/${mediaId}/insights`,
        { params: { metric, access_token: account.igAccessToken } },
      );
      const out: Record<string, number> = {};
      for (const m of res.data.data ?? []) {
        out[m.name] = m.values?.[0]?.value ?? 0;
      }
      return out;
    } catch (err) {
      log.warn(
        { mediaId, metric, error: describeAxiosError(err) },
        'Insights metric set rejected — trying a reduced set',
      );
    }
  }
  return {};
}
