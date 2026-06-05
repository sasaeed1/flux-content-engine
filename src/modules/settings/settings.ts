/**
 * Org-level system settings — persisted in `organizations.metadata.settings`.
 *
 * Settings are validated + defaulted on read so a missing/partial blob always
 * yields a complete, safe object. They drive real behaviour:
 *   - generation.defaultSlideCount → pipeline slide count fallback
 *   - generation.creativity        → content-gen temperature
 *   - motion.*                     → reel defaults (aspect/preset/kinetic)
 */
import type { Json } from '../../types';
import type { ReelAspect } from '../motion/types';

export interface FluxSettings {
  generation: {
    /** null = use the template's slide count. Otherwise 3-10. */
    defaultSlideCount: number | null;
    /** 0..1 — maps to the LLM temperature for content generation. */
    creativity: number;
    /** Preferred hashtag count (3-30). */
    hashtagCount: number;
  };
  motion: {
    defaultAspect: ReelAspect;
    /** Motion philosophy key: still|subtle|dynamic|cinematic|kinetic. */
    defaultPreset: string;
    kineticByDefault: boolean;
  };
  seo: {
    /** Bias topic generation toward SEO-discoverable, long-tail topics. */
    optimize: boolean;
  };
  notifications: {
    onPublish: boolean;
    onFailure: boolean;
  };
}

export const DEFAULT_SETTINGS: FluxSettings = {
  generation: { defaultSlideCount: null, creativity: 0.85, hashtagCount: 18 },
  motion: { defaultAspect: 'reel', defaultPreset: 'cinematic', kineticByDefault: false },
  seo: { optimize: true },
  notifications: { onPublish: true, onFailure: true },
};

const ASPECTS: ReelAspect[] = ['reel', 'square', 'portrait'];
const PRESETS = ['still', 'subtle', 'dynamic', 'cinematic', 'kinetic'];

function num(v: unknown, min: number, max: number, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : dflt;
}
function bool(v: unknown, dflt: boolean): boolean {
  return typeof v === 'boolean' ? v : dflt;
}

/** Read a complete, validated settings object from an org's metadata jsonb. */
export function loadSettings(metadata: Json | null | undefined): FluxSettings {
  const root = (metadata as { settings?: Record<string, unknown> } | null)?.settings ?? {};
  const g = (root.generation ?? {}) as Record<string, unknown>;
  const m = (root.motion ?? {}) as Record<string, unknown>;
  const seo = (root.seo ?? {}) as Record<string, unknown>;
  const n = (root.notifications ?? {}) as Record<string, unknown>;

  const dsc = g.defaultSlideCount;
  return {
    generation: {
      defaultSlideCount:
        typeof dsc === 'number' && dsc >= 3 && dsc <= 10 ? Math.round(dsc) : null,
      creativity: num(g.creativity, 0, 1, DEFAULT_SETTINGS.generation.creativity),
      hashtagCount: Math.round(num(g.hashtagCount, 3, 30, DEFAULT_SETTINGS.generation.hashtagCount)),
    },
    motion: {
      defaultAspect: ASPECTS.includes(m.defaultAspect as ReelAspect)
        ? (m.defaultAspect as ReelAspect)
        : 'reel',
      defaultPreset: PRESETS.includes(m.defaultPreset as string)
        ? (m.defaultPreset as string)
        : 'cinematic',
      kineticByDefault: bool(m.kineticByDefault, false),
    },
    seo: { optimize: bool(seo.optimize, true) },
    notifications: {
      onPublish: bool(n.onPublish, true),
      onFailure: bool(n.onFailure, true),
    },
  };
}

/** Merge an incoming partial patch onto current settings (then re-validate). */
export function mergeSettings(
  current: FluxSettings,
  patch: Record<string, unknown> | null | undefined,
): FluxSettings {
  if (!patch || typeof patch !== 'object') return current;
  const p = patch as Partial<Record<keyof FluxSettings, Record<string, unknown>>>;
  return loadSettings({
    settings: {
      generation: { ...current.generation, ...(p.generation ?? {}) },
      motion: { ...current.motion, ...(p.motion ?? {}) },
      seo: { ...current.seo, ...(p.seo ?? {}) },
      notifications: { ...current.notifications, ...(p.notifications ?? {}) },
    },
  } as Json);
}
