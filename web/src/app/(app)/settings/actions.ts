'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function connectInstagramAction(body: {
  igBusinessAccountId: string;
  accessToken: string;
  username?: string;
  makeDefault?: boolean;
}) {
  const res = await api.connectInstagram(body);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return res;
}

export async function disconnectInstagramAction(id: string) {
  const res = await api.disconnectInstagram(id);
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return res;
}
