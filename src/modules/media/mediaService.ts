/**
 * Media Studio service — the orchestration layer of the AI Media Intelligence
 * Studio (Phase 1, images):
 *   upload → analyze (quality scores) → store + rank → enhance on command,
 *   plus an LLM "creative director" verdict over the ranked set.
 *
 * Deterministic image work (sharp) executes; the LLM acts as the director.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { env } from '../../config/env';
import { uploadBuffer, storagePaths } from '../../lib/storage';
import { ValidationError, NotFoundError, ExternalApiError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import { completeJsonRouted } from '../../ai/router';
import { loadBrandProfile } from '../brand/brandService';
import { analyzeImage, type ImageAnalysis } from './imageIntelligence';
import { enhanceImage } from './imageEnhance';
import { smartCrop, DEFAULT_REFRAME_KEYS, REFRAME_ASPECTS } from './imageReframe';

const log = childLogger({ module: 'media' });

export interface MediaRow {
  id: string;
  organization_id: string;
  kind: string;
  filename: string | null;
  source_url: string;
  enhanced_url: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  analysis: ImageAnalysis | Record<string, unknown>;
  overall_score: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const EXT_BY_FORMAT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  avif: 'avif',
};

export async function uploadAndAnalyze(input: {
  orgId: string;
  buffer: Buffer;
  filename?: string;
  contentType?: string;
}): Promise<MediaRow> {
  if (input.buffer.length === 0) throw new ValidationError('Empty file.');
  const analysis = await analyzeImage(input.buffer);
  const id = randomUUID();
  const ext = EXT_BY_FORMAT[analysis.format] ?? 'jpg';
  const up = await uploadBuffer({
    bucket: env.SUPABASE_MEDIA_BUCKET,
    path: storagePaths.mediaOriginal(input.orgId, id, ext),
    body: input.buffer,
    contentType: input.contentType ?? `image/${analysis.format}`,
  });
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      id,
      organization_id: input.orgId,
      kind: 'image',
      filename: input.filename ?? null,
      source_url: up.publicUrl,
      width: analysis.width,
      height: analysis.height,
      bytes: analysis.bytes,
      analysis,
      overall_score: analysis.scores.social,
      status: 'analyzed',
      metadata: {},
    })
    .select('*')
    .single();
  if (error) throw new ValidationError(error.message);
  log.info({ orgId: input.orgId, id, social: analysis.scores.social }, 'Media analyzed');
  return data as MediaRow;
}

export async function listAssets(orgId: string): Promise<MediaRow[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('organization_id', orgId)
    .order('overall_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new ValidationError(error.message);
  return (data ?? []) as MediaRow[];
}

export async function getAsset(orgId: string, id: string): Promise<MediaRow> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(error.message);
  if (!data) throw new NotFoundError(`Media asset ${id} not found`);
  return data as MediaRow;
}

export async function enhanceAsset(
  orgId: string,
  id: string,
  opts: { upscale?: boolean; brandGrade?: boolean; intensity?: number },
): Promise<MediaRow> {
  const row = await getAsset(orgId, id);
  const res = await fetch(row.source_url);
  if (!res.ok) throw new ExternalApiError('storage', `fetch original failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const analysis = row.analysis as ImageAnalysis;

  let brandColor: string | null = null;
  if (opts.brandGrade) {
    try {
      const brand = await loadBrandProfile(orgId);
      brandColor = brand.theme.colors.accent ?? null;
    } catch {
      /* no brand → skip grade */
    }
  }

  const enhanced = await enhanceImage(buf, analysis, {
    upscale: opts.upscale,
    brandColor,
    intensity: opts.intensity,
  });
  const up = await uploadBuffer({
    bucket: env.SUPABASE_MEDIA_BUCKET,
    path: storagePaths.mediaEnhanced(orgId, id, 'jpg'),
    body: enhanced.buffer,
    contentType: 'image/jpeg',
  });
  const { data, error } = await supabase
    .from('media_assets')
    .update({
      enhanced_url: `${up.publicUrl}?v=${Date.now()}`,
      status: 'enhanced',
      metadata: {
        ...(row.metadata ?? {}),
        enhance_applied: enhanced.applied,
        enhanced_at: new Date().toISOString(),
      },
    })
    .eq('organization_id', orgId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new ValidationError(error.message);
  log.info({ orgId, id, applied: enhanced.applied }, 'Media enhanced');
  return data as MediaRow;
}

export async function reframeAsset(
  orgId: string,
  id: string,
  aspects?: string[],
): Promise<MediaRow> {
  const keys = (aspects && aspects.length ? aspects : DEFAULT_REFRAME_KEYS).filter(
    (k) => k in REFRAME_ASPECTS,
  );
  if (keys.length === 0) throw new ValidationError('No valid aspect ratios requested.');
  const row = await getAsset(orgId, id);
  const src = row.enhanced_url ?? row.source_url;
  const res = await fetch(src);
  if (!res.ok) throw new ExternalApiError('storage', `fetch source failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const crops: Record<string, string> = {};
  for (const key of keys) {
    const c = await smartCrop(buf, key);
    const up = await uploadBuffer({
      bucket: env.SUPABASE_MEDIA_BUCKET,
      path: storagePaths.mediaCrop(orgId, id, key),
      body: c.buffer,
      contentType: 'image/jpeg',
    });
    crops[key] = `${up.publicUrl}?v=${Date.now()}`;
  }
  const { data, error } = await supabase
    .from('media_assets')
    .update({ metadata: { ...(row.metadata ?? {}), crops } })
    .eq('organization_id', orgId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new ValidationError(error.message);
  log.info({ orgId, id, crops: keys }, 'Media reframed');
  return data as MediaRow;
}

export async function deleteAsset(orgId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('media_assets')
    .delete()
    .eq('organization_id', orgId)
    .eq('id', id);
  if (error) throw new ValidationError(error.message);
}

/* ---------- AI creative director ---------- */

const verdictSchema = z.object({
  headline: z.string().max(160),
  hero_pick: z.string().max(120).optional(),
  notes: z.array(z.string().max(200)).max(6),
});

export async function directorVerdict(
  orgId: string,
): Promise<{ headline: string; hero_pick?: string; notes: string[] } | null> {
  const assets = await listAssets(orgId);
  if (assets.length === 0) return null;
  const lines = assets
    .slice(0, 12)
    .map((a, i) => {
      const an = a.analysis as ImageAnalysis;
      const sc = an.scores;
      return `${i + 1}. "${a.filename ?? 'image'}" — social ${sc?.social ?? '?'}/100, sharp ${sc?.sharpness}, exposure ${sc?.exposure}, contrast ${sc?.contrast}, ${a.width}x${a.height}${an.flags?.length ? `; flags: ${an.flags.join(', ')}` : ''}`;
    })
    .join('\n');
  const system =
    "You are an award-winning creative director reviewing a brand's uploaded photos for social content. Be decisive and specific. Pick the hero shot and give crisp, actionable notes.";
  const user = [
    'Analyzed assets (higher scores are better):',
    lines,
    '',
    'Return JSON: { "headline": one punchy sentence on the set, "hero_pick": which image is the hero (by its name/number), "notes": 3-5 short actionable notes — which to use, which to skip, what to fix }',
  ].join('\n');
  try {
    return await completeJsonRouted(
      { system, user, schema: verdictSchema, temperature: 0.5, maxTokens: 700 },
      { tier: 'balanced', cacheEnabled: false },
    );
  } catch (err) {
    log.warn({ orgId, err: (err as Error).message }, 'Director verdict failed');
    return null;
  }
}
