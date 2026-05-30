'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function setWorkspaceModeAction(mode: string) {
  const res = await api.intelligence.setMode(mode);
  revalidatePath('/dashboard');
  revalidatePath('/library');
  revalidatePath('/studio');
  return res;
}

export async function getWorkspaceModeAction(): Promise<string> {
  try {
    const res = await api.intelligence.getMode();
    return res?.mode || 'creator';
  } catch {
    return 'creator';
  }
}
