'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function generateTopicsAction(count: number, themeHint?: string) {
  const res = await api.generateTopics(count, themeHint);
  revalidatePath('/dashboard');
  revalidatePath('/library');
  return res;
}

export async function runPipelineAction(input: {
  topicId?: string;
  approvalMode?: 'auto' | 'manual';
}) {
  const res = await api.runPipeline({
    topicId: input.topicId,
    approvalMode: input.approvalMode ?? 'manual',
  });
  revalidatePath('/dashboard');
  revalidatePath('/library');
  return res;
}
