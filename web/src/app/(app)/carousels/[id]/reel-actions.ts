'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';
import type { ReelRow } from '@/lib/types';

/** Kick off a reel render for a carousel. Returns the `processing` row. */
export async function generateReelAction(
  carouselId: string,
  aspect?: string,
  presetKey?: string,
): Promise<ReelRow> {
  const { reel } = await api.reels.generate({ carouselId, aspect, presetKey });
  revalidatePath(`/library/${carouselId}`);
  return reel;
}

/** Poll a single reel's status (used while it renders in the background). */
export async function getReelAction(id: string): Promise<ReelRow> {
  const { reel } = await api.reels.get(id);
  return reel;
}

/** List reels for a carousel. */
export async function listReelsAction(carouselId: string): Promise<ReelRow[]> {
  const { reels } = await api.reels.list(carouselId);
  return reels;
}
