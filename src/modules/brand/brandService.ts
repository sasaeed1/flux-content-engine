/**
 * Brand Engine — resolve a tenant's brand profile and merge it with its
 * theme preset into a fully-realised BrandTheme for the renderer.
 */
import {
  getBrandById,
  getDefaultBrandForOrg,
  getThemeById,
  getThemeByKey,
} from '../../db/repositories';
import { ConfigError, NotFoundError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import type {
  BrandColors,
  BrandProfile,
  BrandProfileRow,
  BrandTheme,
  BrandTypography,
  Json,
  ThemePresetRow,
} from '../../types';

const log = childLogger({ module: 'brand' });

const DEFAULT_COLORS: BrandColors = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  muted: '#6B7280',
  accent: '#2563EB',
  accentSoft: '#DBEAFE',
};

const DEFAULT_TYPOGRAPHY: BrandTypography = {
  fontPrimary: 'Inter',
  fontDisplay: 'Inter',
  weightDisplay: 900,
  weightBody: 500,
  sizeHook: 92,
  sizeBody: 40,
};

function mergeColors(preset: Json, override: Json): BrandColors {
  return {
    ...(DEFAULT_COLORS as Record<string, string>),
    ...(preset as Record<string, string>),
    ...(override as Record<string, string>),
  } as BrandColors;
}

function mergeTypography(preset: Json, override: Json): BrandTypography {
  return {
    ...(DEFAULT_TYPOGRAPHY as Record<string, string | number>),
    ...(preset as Record<string, string | number>),
    ...(override as Record<string, string | number>),
  } as BrandTypography;
}

function buildTheme(
  brand: BrandProfileRow,
  preset: ThemePresetRow | null,
): BrandTheme {
  const presetColors = (preset?.colors ?? {}) as Json;
  const presetType = (preset?.typography ?? {}) as Json;
  return {
    presetKey: preset?.key ?? null,
    colors: mergeColors(presetColors, brand.colors),
    typography: mergeTypography(presetType, brand.typography),
    visualTone: preset?.visual_tone ?? null,
    effects: (preset?.effects ?? {}) as Json,
  };
}

function rowToProfile(brand: BrandProfileRow, theme: BrandTheme): BrandProfile {
  return {
    id: brand.id,
    organizationId: brand.organization_id,
    name: brand.name,
    niche: brand.niche,
    businessType: brand.business_type,
    tone: brand.tone,
    postStyle: brand.post_style,
    ctaStyle: brand.cta_style,
    logoUrl: brand.logo_url,
    voiceKeywords: brand.voice_keywords ?? [],
    voiceAvoid: brand.voice_avoid ?? [],
    theme,
  };
}

/**
 * Resolve a brand for an organization. If `brandId` is omitted, returns the
 * org's default brand. Errors if none exists yet.
 */
export async function loadBrandProfile(
  orgId: string,
  brandId?: string | null,
): Promise<BrandProfile> {
  const row = brandId
    ? await getBrandById(orgId, brandId)
    : await getDefaultBrandForOrg(orgId);

  if (!row) {
    throw new NotFoundError(
      brandId
        ? `Brand profile ${brandId} not found for organization ${orgId}`
        : `Organization ${orgId} has no default brand profile. Create one first.`,
    );
  }

  const preset = row.theme_preset_id ? await getThemeById(row.theme_preset_id) : null;
  const theme = buildTheme(row, preset);
  log.debug({ brandId: row.id, presetKey: theme.presetKey }, 'Brand resolved');
  return rowToProfile(row, theme);
}

/**
 * Resolve a brand purely from a theme key — useful for previews/seeds where
 * an org doesn't have a brand profile yet.
 */
export async function loadBrandFromTheme(themeKey: string): Promise<BrandTheme> {
  const preset = await getThemeByKey(themeKey);
  if (!preset) throw new NotFoundError(`Theme preset "${themeKey}" not found`);
  return buildTheme(
    {
      colors: {} as Json,
      typography: {} as Json,
    } as BrandProfileRow,
    preset,
  );
}

/** Throw if a critical color is missing (defensive — DEFAULTS should cover it). */
export function assertRenderableTheme(theme: BrandTheme): void {
  for (const key of ['background', 'foreground', 'accent'] as const) {
    if (!theme.colors[key]) {
      throw new ConfigError(`Brand theme is missing required color "${key}"`);
    }
  }
}
