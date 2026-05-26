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
  },
) {
  await api.updateBrand(brandId, patch);
  revalidatePath('/brand');
  revalidatePath('/dashboard');
}
