'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

type CaptionStyle = Parameters<typeof api.rewriteCaption>[1];
type SlideStyle = Parameters<typeof api.rewriteSlide>[2];

export async function setCaptionAction(id: string, caption: string) {
  const res = await api.setCaption(id, caption);
  revalidatePath(`/library/${id}`);
  return res;
}

export async function rewriteCaptionAction(id: string, style: CaptionStyle) {
  const res = await api.rewriteCaption(id, style);
  revalidatePath(`/library/${id}`);
  return res;
}

export async function setCtaAction(id: string, cta: string) {
  const res = await api.setCta(id, cta);
  revalidatePath(`/library/${id}`);
  return res;
}

export async function rewriteCtaAction(id: string, variations = 3) {
  return await api.rewriteCta(id, variations);
}

export async function rewriteSlideAction(id: string, idx: number, style: SlideStyle) {
  const res = await api.rewriteSlide(id, idx, style);
  revalidatePath(`/library/${id}`);
  return res;
}

export async function setSlideAction(
  id: string,
  idx: number,
  data: Record<string, unknown>,
) {
  const res = await api.setSlide(id, idx, data);
  revalidatePath(`/library/${id}`);
  return res;
}

export async function bulkApproveAction(carouselIds: string[], publishAt?: string) {
  const res = await api.bulkApprove(carouselIds, publishAt);
  revalidatePath('/library');
  revalidatePath('/home');
  return res;
}

// Post-audit #4 — live theme reapply on an existing carousel.
// Re-renders every slide under the new style mode without re-running
// content generation. Returns the new image URLs so the UI can swap
// previews immediately.
export async function restyleCarouselAction(id: string, styleModeKey: string) {
  const res = await api.restyleCarousel(id, styleModeKey);
  revalidatePath(`/library/${id}`);
  revalidatePath('/library');
  return res;
}
