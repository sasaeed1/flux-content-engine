'use server';

import { api } from '@/lib/api-client';

/**
 * Seed a fresh topic for the Forge, returning the ids the streaming pipeline
 * needs. The /api/pipeline/stream endpoint resolves by topicId, so we insert
 * the typed topic first and hand back its id + the default brand.
 */
export async function seedForgeTopicAction(topic: string): Promise<{
  topicId: string | null;
  brandProfileId: string | null;
}> {
  let brandProfileId: string | null = null;
  try {
    const brand = await api.brand();
    brandProfileId = brand.default?.id ?? null;
  } catch {
    /* neutral brand fallback handled engine-side */
  }

  let topicId: string | null = null;
  try {
    const res = await api.addTopics([{ topic, postType: 'carousel', priority: 1 }]);
    const first = (res.topics?.[0] ?? null) as { id?: string } | null;
    topicId = first?.id ?? null;
  } catch {
    /* if seeding fails the stream falls back to next pending topic */
  }

  return { topicId, brandProfileId };
}

/** Persist an edited draft slide's data (Sprint D inline editing). */
export async function saveDraftSlideAction(
  carouselId: string,
  idx: number,
  data: Record<string, unknown>,
) {
  return await api.setSlide(carouselId, idx, data);
}

/** Render an edited draft carousel into images and flip it to 'ready'. */
export async function renderDraftAction(carouselId: string) {
  const res = await api.renderCarousel(carouselId);
  return res;
}
