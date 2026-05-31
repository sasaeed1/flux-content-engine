'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

/** Dismiss an opportunity from the Home feed. */
export async function dismissHomeInsightAction(id: string) {
  await api.intelligence.dismissInsight(id);
  revalidatePath('/home');
}

/** Manually re-run the insight generator (the "refresh observations" affordance). */
export async function refreshHomeInsightsAction() {
  const res = await api.intelligence.refreshInsights();
  revalidatePath('/home');
  return res;
}
