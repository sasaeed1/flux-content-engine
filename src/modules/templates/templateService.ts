/**
 * Template Service — loads a Template (org-custom first, system fallback).
 * Validates the JSON `definition` so downstream code can rely on its shape.
 */
import { z } from 'zod';
import { getTemplateByKey, getTemplateById } from '../../db/repositories';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { env } from '../../config/env';
import type { Template, TemplateDefinition, TemplateRow } from '../../types';

const slideDefSchema = z.object({
  role: z.enum(['hook', 'content', 'cta', 'quote']),
  layout: z.string(),
  slots: z.array(z.string()).min(1),
});

const templateDefinitionSchema = z.object({
  kind: z.enum(['single', 'carousel']),
  slides: z.array(slideDefSchema).min(1),
  renderer: z.literal('html-puppeteer'),
  htmlTemplate: z.string(),
  defaults: z.record(z.string(), z.unknown()).optional(),
});

function parseDefinition(row: TemplateRow): TemplateDefinition {
  const result = templateDefinitionSchema.safeParse(row.definition);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(`Template "${row.key}" has invalid definition: ${detail}`);
  }
  return result.data;
}

function rowToTemplate(row: TemplateRow, def: TemplateDefinition): Template {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    key: row.key,
    type: row.type,
    slideCount: row.slide_count ?? def.slides.length,
    definition: def,
    isSystem: row.is_system,
  };
}

export async function loadTemplate(orgId: string, key: string): Promise<Template> {
  const row = await getTemplateByKey(orgId, key);
  if (!row) {
    throw new NotFoundError(`Template "${key}" not found (org-custom or system)`);
  }
  return rowToTemplate(row, parseDefinition(row));
}

export async function loadTemplateById(id: string): Promise<Template> {
  const row = await getTemplateById(id);
  if (!row) throw new NotFoundError(`Template id ${id} not found`);
  return rowToTemplate(row, parseDefinition(row));
}

/** Default carousel template key — system-shipped (see seed.sql). */
export const DEFAULT_CAROUSEL_KEY = 'carousel.educational.v1';
export const DEFAULT_QUOTE_KEY = 'single.quote.v1';
export const DEFAULT_CTA_KEY = 'single.cta.v1';

/** Pick a sensible default template key from a post type. */
export function defaultTemplateKeyForType(postType: string): string {
  switch (postType) {
    case 'quote':
      return DEFAULT_QUOTE_KEY;
    case 'single':
    case 'cta':
    case 'announcement':
    case 'lead_magnet':
    case 'promotional':
      return DEFAULT_CTA_KEY;
    case 'carousel':
    case 'educational':
    default:
      return DEFAULT_CAROUSEL_KEY;
  }
}

/** Cap the slide count to the platform max from env. */
export function clampCarouselSlideCount(n: number): number {
  return Math.max(2, Math.min(n, env.MAX_CAROUSEL_SLIDES));
}
