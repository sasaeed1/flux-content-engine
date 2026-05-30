/**
 * Brand DNA Extractor — Phase 3C.
 *
 * Reads a brand-kit asset (logo PNG, brand book PDF, style guide image) from
 * Supabase Storage and proposes a "brand DNA" update for the org's default
 * brand profile.
 *
 * Pipeline:
 *   1. Download asset bytes from Supabase Storage (logo bucket).
 *   2. If image (PNG/JPG/WebP/SVG-rasterized): use sharp to extract the
 *      dominant color palette via histogram quantisation.
 *   3. If PDF: pdf-parse the first ~5000 chars of text (cover + first pages).
 *   4. Pass extracted evidence (colors + text + filename + current brand) to
 *      an LLM in JSON mode. Schema enforces a minimal but actionable shape
 *      that the user can review and accept in the Brand editor.
 *
 * The output is *proposed* — never auto-applied. The Brand page surfaces a
 * "Review extracted DNA" modal where the user accepts/edits before save.
 *
 * Provider routing reuses the standard `completeJsonRouted` so this respects
 * quota tracking + cache like every other LLM call.
 */
import sharp from 'sharp';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { env } from '../../config/env';
import { childLogger } from '../../lib/logger';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { completeJsonRouted } from '../../ai/router';
import { loadBrandProfile } from './brandService';
import type { BrandColors, BrandTypography } from '../../types';

const log = childLogger({ module: 'brand-dna-extractor' });

/** Lightweight pdf-parse loader — keeps the dep optional at runtime so a
 *  missing install doesn't crash the rest of the brand surface. */
async function loadPdfParse(): Promise<((b: Buffer) => Promise<{ text: string }>) | null> {
  try {
    const mod = await import('pdf-parse');
    // pdf-parse default export is a function
    const fn = (mod as { default?: unknown }).default ?? mod;
    return fn as (b: Buffer) => Promise<{ text: string }>;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'pdf-parse unavailable — PDF text extraction disabled');
    return null;
  }
}

/* ============================================================
 *  Output schema — the proposed brand DNA the LLM returns.
 * ============================================================ */

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = z.string().regex(HEX, 'Must be #RRGGBB');

const ProposedDnaSchema = z.object({
  colors: z
    .object({
      background: hex.optional(),
      foreground: hex.optional(),
      accent: hex.optional(),
      accentSoft: hex.optional(),
      muted: hex.optional(),
    })
    .default({}),
  typography: z
    .object({
      fontPrimary: z.string().max(60).optional(),
      fontDisplay: z.string().max(60).optional(),
    })
    .default({}),
  /** 1-sentence brand voice (e.g. "confident, direct, no fluff"). */
  tone: z.string().max(220).optional(),
  /** Suggested post style (educational | inspirational | storytelling | etc). */
  postStyle: z.string().max(40).optional(),
  /** Suggested CTA pattern (e.g. "Follow for more weekly drops"). */
  ctaStyle: z.string().max(140).optional(),
  /** 3-8 words that the brand voice leans into. */
  voiceKeywords: z.array(z.string().max(40)).max(12).default([]),
  /** Words the brand avoids — guardrails for generation. */
  voiceAvoid: z.array(z.string().max(40)).max(12).default([]),
  /** Short 1-2 sentence summary the user sees in the review modal. */
  summary: z.string().max(400).optional(),
  /** LLM self-rating 0-1 of how confident it is given the evidence. */
  confidence: z.number().min(0).max(1).optional(),
});

export type ProposedBrandDna = z.infer<typeof ProposedDnaSchema>;

export interface ExtractionResult {
  assetId: string;
  evidence: {
    palette: string[]; // hex codes pulled from image
    pdfTextPreview: string | null;
    sourceFilename: string | null;
    sourceContentType: string | null;
  };
  proposed: ProposedBrandDna;
  extractedAt: string;
}

/* ============================================================
 *  Image color extraction (sharp).
 * ============================================================ */

/** Round a channel to the nearest "bucket" so visually-similar pixels map to
 *  the same histogram cell. 24 buckets keeps the palette stable across noise. */
function bucket(v: number, step = 24): number {
  return Math.min(255, Math.round(v / step) * step);
}

function hexFromRgb(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Cheap "is this an off-white background pixel" check — skip them in the
 *  palette so logos on white don't get "white" as their dominant color. */
function isBackgroundish(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 235 && max - min < 16) return true; // near-white
  if (max < 18) return true; // near-black (still keep, but de-prioritise)
  return false;
}

/**
 * Extract the top N dominant colors from an image buffer.
 *
 * Strategy: down-sample to 200x200, quantise each channel into 24-step buckets,
 * histogram the buckets, drop near-white pixels, return the top N by count.
 * Fast enough to run inline on upload (<200ms for typical logos).
 */
export async function extractPaletteFromImage(
  buf: Buffer,
  topN = 6,
): Promise<string[]> {
  const { data, info } = await sharp(buf)
    .resize(200, 200, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map<string, { hex: string; count: number; priority: number }>();
  const channels = info.channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = bucket(data[i]);
    const g = bucket(data[i + 1]);
    const b = bucket(data[i + 2]);
    const key = `${r},${g},${b}`;
    if (isBackgroundish(r, g, b)) continue;

    const existing = counts.get(key);
    if (existing) existing.count++;
    else {
      counts.set(key, {
        hex: hexFromRgb(r, g, b),
        count: 1,
        priority: 1,
      });
    }
  }

  const sorted = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((c) => c.hex);

  return sorted;
}

/** Render the first page of a PDF to an image, then extract its palette.
 *  Stub for now — would need pdfjs/poppler. Returns []. */
async function extractPaletteFromPdf(_buf: Buffer): Promise<string[]> {
  return [];
}

/* ============================================================
 *  PDF text extraction.
 * ============================================================ */

async function extractPdfText(buf: Buffer, maxChars = 5000): Promise<string | null> {
  const parser = await loadPdfParse();
  if (!parser) return null;
  try {
    const r = await parser(buf);
    return (r.text || '').slice(0, maxChars).trim() || null;
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'PDF parse failed');
    return null;
  }
}

/* ============================================================
 *  LLM proposal — small, deterministic.
 * ============================================================ */

function buildExtractionPrompt(args: {
  brandName: string;
  niche: string | null;
  palette: string[];
  pdfText: string | null;
  filename: string | null;
}): { system: string; user: string } {
  const system = `You are a brand strategist analysing a single uploaded brand asset to extract a concise brand DNA proposal.

Rules:
- Stay grounded in the provided evidence. Do NOT invent colors if the palette is empty.
- Tone should be 1 short sentence describing the brand voice.
- Voice keywords: 3-8 single words the brand leans into (e.g. "bold", "clear", "playful", "rigorous").
- Voice avoid: 0-6 single words the brand should NEVER use (e.g. "synergy", "unleash").
- Suggested postStyle: one of "educational", "inspirational", "storytelling", "data-driven", "minimalist", "contrarian", "luxury".
- ctaStyle: a short, voicy CTA pattern (e.g. "Save this for later" or "Follow for the next deep dive").
- Confidence: 0.2-0.5 if you only have file metadata, 0.5-0.8 if you have palette OR text, 0.8-1.0 if you have both.
- Output a SINGLE valid JSON object. No markdown, no prose.`;

  const evidenceParts: string[] = [];
  evidenceParts.push(`Brand name: ${args.brandName}`);
  if (args.niche) evidenceParts.push(`Niche: ${args.niche}`);
  if (args.filename) evidenceParts.push(`Source file: ${args.filename}`);
  if (args.palette.length > 0) {
    evidenceParts.push(
      `Dominant colors extracted from image (most → least frequent): ${args.palette.join(', ')}`,
    );
  } else {
    evidenceParts.push(`No dominant colors could be extracted from this asset.`);
  }
  if (args.pdfText) {
    evidenceParts.push(
      `Text excerpt from brand document (first 5KB):\n"""\n${args.pdfText}\n"""`,
    );
  }
  const user = `${evidenceParts.join('\n\n')}\n\nReturn the brand DNA proposal as JSON matching this shape:
{
  "colors": { "background": "#RRGGBB", "foreground": "#RRGGBB", "accent": "#RRGGBB", "accentSoft": "#RRGGBB", "muted": "#RRGGBB" },
  "typography": { "fontPrimary": "string", "fontDisplay": "string" },
  "tone": "1-sentence voice description",
  "postStyle": "educational | inspirational | storytelling | data-driven | minimalist | contrarian | luxury",
  "ctaStyle": "short voicy CTA pattern",
  "voiceKeywords": ["word1", "word2", "word3"],
  "voiceAvoid": ["word1", "word2"],
  "summary": "1-2 sentence summary of what you found",
  "confidence": 0.0-1.0
}`;

  return { system, user };
}

/* ============================================================
 *  Main entry point.
 * ============================================================ */

interface BrandAssetRow {
  id: string;
  organization_id: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
}

async function fetchAsset(orgId: string, assetId: string): Promise<BrandAssetRow> {
  const { data, error } = await supabase
    .from('generated_assets')
    .select('id, organization_id, storage_path, metadata')
    .eq('organization_id', orgId)
    .eq('id', assetId)
    .eq('provider', 'brand-kit')
    .maybeSingle();
  if (error) throw new ValidationError(error.message);
  if (!data) throw new NotFoundError(`Brand asset ${assetId} not found`);
  return data as BrandAssetRow;
}

async function downloadAsset(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(env.SUPABASE_LOGO_BUCKET).download(path);
  if (error || !data) {
    throw new ValidationError(`Failed to download brand asset: ${error?.message ?? 'no data'}`);
  }
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

function inferKindFromMetadata(metadata: Record<string, unknown> | null): {
  isImage: boolean;
  isPdf: boolean;
  filename: string | null;
  contentType: string | null;
} {
  const ct = (metadata?.content_type as string | undefined) ?? null;
  const fn = (metadata?.original_filename as string | undefined) ?? null;
  const lct = (ct ?? '').toLowerCase();
  const lfn = (fn ?? '').toLowerCase();
  const isPdf = lct.includes('pdf') || lfn.endsWith('.pdf');
  const isImage =
    lct.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg)$/.test(lfn);
  return { isImage: isImage && !isPdf, isPdf, filename: fn, contentType: ct };
}

/**
 * Extract a brand DNA proposal for the given asset. Persists the result into
 * the asset's metadata.extraction. Does NOT mutate the brand profile — the UI
 * presents the proposal for review.
 */
export async function extractDnaForAsset(
  orgId: string,
  assetId: string,
): Promise<ExtractionResult> {
  const t0 = Date.now();
  const asset = await fetchAsset(orgId, assetId);
  const kind = inferKindFromMetadata(asset.metadata);

  // Download bytes — if storage is unreachable we fail fast.
  const buf = await downloadAsset(asset.storage_path);

  // Evidence gathering — best-effort, never throws into the LLM call.
  let palette: string[] = [];
  let pdfText: string | null = null;

  if (kind.isImage) {
    try {
      palette = await extractPaletteFromImage(buf, 6);
    } catch (err) {
      log.warn({ err: (err as Error).message, assetId }, 'image palette extraction failed');
    }
  } else if (kind.isPdf) {
    try {
      pdfText = await extractPdfText(buf, 5000);
    } catch (err) {
      log.warn({ err: (err as Error).message, assetId }, 'pdf text extraction failed');
    }
    // Bonus: attempt palette from rasterised first page. Stubbed for now.
    if (palette.length === 0) palette = await extractPaletteFromPdf(buf);
  }

  // Load current brand context so the LLM can write tone in-character.
  const brand = await loadBrandProfile(orgId).catch(() => null);

  const { system, user } = buildExtractionPrompt({
    brandName: brand?.name ?? 'Unnamed brand',
    niche: brand?.niche ?? null,
    palette,
    pdfText,
    filename: kind.filename,
  });

  const proposed = await completeJsonRouted(
    {
      system,
      user,
      schema: ProposedDnaSchema,
      temperature: 0.3, // low — we want grounded extraction, not creativity
      maxTokens: 900,
    },
    { tier: 'fast', cacheEnabled: true },
  );

  const result: ExtractionResult = {
    assetId,
    evidence: {
      palette,
      pdfTextPreview: pdfText ? pdfText.slice(0, 800) : null,
      sourceFilename: kind.filename,
      sourceContentType: kind.contentType,
    },
    proposed,
    extractedAt: new Date().toISOString(),
  };

  // Persist into the asset row so the user can re-open the modal later.
  await supabase
    .from('generated_assets')
    .update({
      metadata: {
        ...(asset.metadata ?? {}),
        extraction: {
          status: 'ready',
          extracted_at: result.extractedAt,
          evidence: result.evidence,
          proposed: result.proposed,
        },
      },
    })
    .eq('id', assetId)
    .eq('organization_id', orgId);

  log.info(
    {
      assetId,
      paletteCount: palette.length,
      hasPdfText: !!pdfText,
      confidence: proposed.confidence,
      ms: Date.now() - t0,
    },
    'Brand DNA extraction complete',
  );

  return result;
}

/* ============================================================
 *  Apply — merge accepted DNA into a brand profile.
 * ============================================================ */

export interface ApplyDnaOptions {
  /** Which slots the user accepted. Empty = apply everything. */
  accept?: Array<
    | 'colors'
    | 'typography'
    | 'tone'
    | 'postStyle'
    | 'ctaStyle'
    | 'voiceKeywords'
    | 'voiceAvoid'
  >;
}

/**
 * Translate a ProposedBrandDna into a brand-profile patch (snake_case columns)
 * the existing PATCH /api/tenant/brand/:id route already accepts. Returns the
 * patch — the caller decides whether to apply.
 */
export function dnaToBrandPatch(
  dna: ProposedBrandDna,
  options: ApplyDnaOptions = {},
): Record<string, unknown> {
  const accept = options.accept ?? [
    'colors',
    'typography',
    'tone',
    'postStyle',
    'ctaStyle',
    'voiceKeywords',
    'voiceAvoid',
  ];
  const patch: Record<string, unknown> = {};

  if (accept.includes('colors')) {
    const colors: Partial<BrandColors> = {};
    for (const [k, v] of Object.entries(dna.colors)) {
      if (typeof v === 'string' && HEX.test(v)) {
        (colors as Record<string, string>)[k] = v;
      }
    }
    if (Object.keys(colors).length > 0) patch.colors = colors;
  }

  if (accept.includes('typography')) {
    const t: Partial<BrandTypography> = {};
    if (dna.typography.fontPrimary) t.fontPrimary = dna.typography.fontPrimary;
    if (dna.typography.fontDisplay) t.fontDisplay = dna.typography.fontDisplay;
    if (Object.keys(t).length > 0) patch.typography = t;
  }

  if (accept.includes('tone') && dna.tone) patch.tone = dna.tone;
  if (accept.includes('postStyle') && dna.postStyle) patch.post_style = dna.postStyle;
  if (accept.includes('ctaStyle') && dna.ctaStyle) patch.cta_style = dna.ctaStyle;
  if (accept.includes('voiceKeywords') && dna.voiceKeywords.length > 0) {
    patch.voice_keywords = dna.voiceKeywords;
  }
  if (accept.includes('voiceAvoid') && dna.voiceAvoid.length > 0) {
    patch.voice_avoid = dna.voiceAvoid;
  }

  return patch;
}
