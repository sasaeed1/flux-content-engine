'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

/** Move a topic to a new calendar day (drag/click reschedule). */
export async function rescheduleTopicAction(id: string, scheduledDate: string) {
  const res = await api.updateTopic(id, { scheduledDate });
  revalidatePath('/campaign');
  return res;
}

/** Remove a topic from the calendar. */
export async function removeTopicAction(id: string) {
  const res = await api.deleteTopic(id);
  revalidatePath('/campaign');
  return res;
}

/** Generate N AI topics to fill the queue, optionally themed. */
export async function generateCampaignTopicsAction(count: number, themeHint?: string) {
  const res = await api.generateTopics(count, themeHint);
  revalidatePath('/campaign');
  return res;
}

/** Generate on-brand topics by analyzing a website URL. */
export async function generateFromWebsiteAction(url: string, count = 8) {
  const res = await api.topicsFromWebsite(url, count);
  revalidatePath('/campaign');
  return res;
}

/** Add a single topic on a specific day. */
export async function addTopicOnDayAction(topic: string, scheduledDate: string) {
  const res = await api.addTopics([{ topic, postType: 'carousel', scheduledDate, priority: 1 }]);
  revalidatePath('/campaign');
  return res;
}

/** Sprint H — forge a month of carousels from pending topics (background batch).
 *  Full render (draftOnly:false) so finished carousels land in the Library as
 *  "ready" — "forge the month" should produce usable posts, not bare scripts.
 *  (The explicit per-carousel "Draft first" toggle in the Forge still drafts.) */
export async function forgeTheMonthAction(count: number, styleModeKey?: string) {
  const res = await api.batchPipeline({ count, draftOnly: false, styleModeKey });
  revalidatePath('/campaign');
  revalidatePath('/library');
  return res;
}
