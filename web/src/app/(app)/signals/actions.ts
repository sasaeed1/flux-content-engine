'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

/** Generate the org's weekly AI briefing on demand (Sprint E). */
export async function refreshWeeklyBriefingAction() {
  const res = await api.intelligence.refreshWeeklySummary();
  revalidatePath('/signals');
  return res;
}
