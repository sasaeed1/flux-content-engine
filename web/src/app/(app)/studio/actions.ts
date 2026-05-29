'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function generateFromStudioAction(input: {
  topic: string;
  themeKey?: string | null;
  count?: number;
}) {
  // Phase 2 wires Studio to the existing pipeline endpoint. Future phases
  // add streaming + per-slide live generation.
  const orgBrand = await api.brand();
  const brandId = orgBrand.default?.id;

  // Insert topic(s) first so the pipeline has something to consume.
  await api.addTopics([
    {
      topic: input.topic,
      postType: 'carousel',
      priority: 1,
    },
  ]);

  // Then run the pipeline against this fresh topic.
  const res = (await api.runPipeline({
    brandProfileId: brandId ?? undefined,
    approvalMode: 'manual',
  })) as { runId?: string; carouselId?: string; imageUrls?: string[] };

  revalidatePath('/studio');
  revalidatePath('/library');
  revalidatePath('/dashboard');
  return res;
}

export async function dismissInsightAction(id: string) {
  await api.intelligence.dismissInsight(id);
  revalidatePath('/dashboard');
  revalidatePath('/studio');
}

export async function refreshInsightsAction() {
  return await api.intelligence.refreshInsights();
}

export async function generateHooksAction(topic: string, count = 6) {
  return await api.intelligence.hooks({ topic, count });
}
