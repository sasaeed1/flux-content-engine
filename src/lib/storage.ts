/** Supabase Storage helpers — provisioning + uploads + tenant paths. */
import { supabase } from './supabase';
import { env } from '../config/env';
import { logger } from './logger';
import { AppError } from './errors';

/** Idempotently ensure the public buckets exist. Called at startup. */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of [
    env.SUPABASE_IMAGE_BUCKET,
    env.SUPABASE_RENDER_BUCKET,
    env.SUPABASE_LOGO_BUCKET,
    env.SUPABASE_REEL_BUCKET,
  ]) {
    const { data } = await supabase.storage.getBucket(bucket);
    if (data) continue;

    // No fileSizeLimit — inherit the plan default (free tier caps at 50MB).
    const { error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error && !/exist/i.test(error.message)) {
      throw new AppError(`Failed to create storage bucket "${bucket}": ${error.message}`);
    }
    logger.info({ bucket }, 'Storage bucket ready');
  }
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export async function uploadBuffer(opts: {
  bucket: string;
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<UploadResult> {
  const { error } = await supabase.storage.from(opts.bucket).upload(opts.path, opts.body, {
    contentType: opts.contentType,
    upsert: true,
  });
  if (error) {
    throw new AppError(`Storage upload failed for "${opts.path}": ${error.message}`);
  }
  const { data } = supabase.storage.from(opts.bucket).getPublicUrl(opts.path);
  return { path: opts.path, publicUrl: data.publicUrl };
}

/* ============================================================
 *  Tenant-scoped storage paths.
 *  Convention: every blob is rooted under  orgs/{orgId}/...
 *  so multi-tenant data is clearly partitioned within each bucket.
 * ============================================================ */

export const storagePaths = {
  /** Final rendered slide PNG for a carousel/post run. */
  render: (orgId: string, runId: string, slideIndex: number): string =>
    `orgs/${orgId}/runs/${runId}/slides/${slideIndex}.png`,
  /** Raw AI-generated image (pre-composition). */
  aiImage: (orgId: string, runId: string, slideIndex: number): string =>
    `orgs/${orgId}/runs/${runId}/ai/${slideIndex}.png`,
  /** Brand logo (uploaded once per brand profile). */
  logo: (orgId: string, brandProfileId: string, ext = 'png'): string =>
    `orgs/${orgId}/brands/${brandProfileId}/logo.${ext}`,
  /** Brand kit assets (PDFs, style guides, etc.). */
  brandAsset: (orgId: string, assetId: string, ext: string): string =>
    `orgs/${orgId}/brand-kit/${assetId}.${ext}`,
  /** Final rendered cinematic reel (MP4) for a carousel. */
  reel: (orgId: string, reelId: string): string => `orgs/${orgId}/reels/${reelId}.mp4`,
};
