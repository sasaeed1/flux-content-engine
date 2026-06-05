'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function updateBrandAction(
  brandId: string,
  patch: {
    name?: string;
    niche?: string | null;
    businessType?: string | null;
    tone?: string | null;
    ctaStyle?: string | null;
    postStyle?: string | null;
    voiceKeywords?: string[];
    voiceAvoid?: string[];
    themePresetKey?: string | null;
    website?: string | null;
    personality?: { aggression: number; minimalism: number; luxury: number; energy: number };
  },
) {
  await api.updateBrand(brandId, patch);
  revalidatePath('/brand');
  revalidatePath('/dashboard');
}

export async function createBrandAction(body: {
  name: string;
  niche?: string | null;
  businessType?: string | null;
  tone?: string | null;
  ctaStyle?: string | null;
  postStyle?: string | null;
  voiceKeywords?: string[];
  voiceAvoid?: string[];
  themePresetKey?: string | null;
  website?: string | null;
  personality?: { aggression: number; minimalism: number; luxury: number; energy: number };
}) {
  const res = await api.createBrand({
    ...body,
    is_default: true,
  });
  revalidatePath('/brand');
  revalidatePath('/dashboard');
  return res;
}
