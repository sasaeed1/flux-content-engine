'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

type CaptionStyle = Parameters<typeof api.rewriteCaption>[1];
type SlideStyle = Parameters<typeof api.rewriteSlide>[2];

export async function setCaptionAction(id: string, caption: string) {
  const res = await api.setCaption(id, caption);
  revalidatePath(`/carousels/${id}`);
  return res;
}

export async function rewriteCaptionAction(id: string, style: CaptionStyle) {
  const res = await api.rewriteCaption(id, style);
  revalidatePath(`/carousels/${id}`);
  return res;
}

export async function setCtaAction(id: string, cta: string) {
  const res = await api.setCta(id, cta);
  revalidatePath(`/carousels/${id}`);
  return res;
}

export async function rewriteCtaAction(id: string, variations = 3) {
  return await api.rewriteCta(id, variations);
}

export async function rewriteSlideAction(id: string, idx: number, style: SlideStyle) {
  const res = await api.rewriteSlide(id, idx, style);
  revalidatePath(`/carousels/${id}`);
  return res;
}

export async function setSlideAction(
  id: string,
  idx: number,
  data: Record<string, unknown>,
) {
  const res = await api.setSlide(id, idx, data);
  revalidatePath(`/carousels/${id}`);
  return res;
}

export async function bulkApproveAction(carouselIds: string[], publishAt?: string) {
  const res = await api.bulkApprove(carouselIds, publishAt);
  revalidatePath('/library');
  revalidatePath('/dashboard');
  return res;
}
