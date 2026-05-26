'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function approveCarouselAction(id: string, publishAt?: string) {
  await api.approveCarousel(id, publishAt);
  revalidatePath(`/carousels/${id}`);
  revalidatePath('/library');
  revalidatePath('/dashboard');
}
