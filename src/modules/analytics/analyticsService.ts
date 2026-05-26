/** Analytics — seed on publish, refresh insights for recent posts. */
import { fetchMediaInsights } from '../publish/instagramService';
import { resolveInstagramAccount } from '../publish/accountService';
import { getRecentPublishedPosts, insertAnalytics } from '../../db/repositories';
import { toErrorMessage } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import type { PublishedPostRow } from '../../types';

const log = childLogger({ module: 'analytics' });

export async function seedAnalytics(input: {
  organizationId: string;
  publishedPostId: string;
  igMediaId: string;
}): Promise<void> {
  await insertAnalytics({
    organization_id: input.organizationId,
    published_post_id: input.publishedPostId,
    ig_media_id: input.igMediaId,
    snapshot: { seeded: true },
  });
}

async function refreshPost(post: PublishedPostRow): Promise<boolean> {
  if (!post.ig_media_id || !post.instagram_account_id) return false;
  const account = await resolveInstagramAccount(post.organization_id, post.instagram_account_id);
  const insights = await fetchMediaInsights(account, post.ig_media_id);
  if (Object.keys(insights).length === 0) return false;

  await insertAnalytics({
    organization_id: post.organization_id,
    published_post_id: post.id,
    ig_media_id: post.ig_media_id,
    views: insights.views ?? insights.plays ?? 0,
    reach: insights.reach ?? 0,
    likes: insights.likes ?? 0,
    comments: insights.comments ?? 0,
    shares: insights.shares ?? 0,
    saves: insights.saved ?? 0,
    profile_visits: insights.profile_visits ?? 0,
    follows_from_post: insights.follows ?? 0,
    total_interactions: insights.total_interactions ?? 0,
    snapshot: insights,
  });
  return true;
}

export async function collectRecentAnalytics(sinceHours = 96): Promise<{
  checked: number;
  updated: number;
}> {
  const posts = await getRecentPublishedPosts(sinceHours);
  let updated = 0;

  for (const post of posts) {
    try {
      if (await refreshPost(post)) updated += 1;
    } catch (err) {
      log.warn({ postId: post.id, error: toErrorMessage(err) }, 'Failed to refresh analytics');
    }
  }
  log.info({ checked: posts.length, updated }, 'Analytics collection complete');
  return { checked: posts.length, updated };
}
