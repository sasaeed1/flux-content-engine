'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function uploadMediaAction(body: {
  filename?: string;
  contentType?: string;
  data: string;
}) {
  const res = await api.uploadMedia(body);
  revalidatePath('/media');
  return res;
}

export async function enhanceMediaAction(
  id: string,
  opts: { upscale?: boolean; brandGrade?: boolean; intensity?: number },
) {
  const res = await api.enhanceMedia(id, opts);
  revalidatePath('/media');
  return res;
}

export async function reframeMediaAction(id: string, aspects?: string[]) {
  const res = await api.reframeMedia(id, aspects);
  revalidatePath('/media');
  return res;
}

export async function backgroundMediaAction(id: string, styles?: string[]) {
  const res = await api.backgroundMedia(id, styles);
  revalidatePath('/media');
  return res;
}

export async function deleteMediaAction(id: string) {
  const res = await api.deleteMedia(id);
  revalidatePath('/media');
  return res;
}

export async function mediaDirectorAction() {
  return await api.mediaDirector();
}
