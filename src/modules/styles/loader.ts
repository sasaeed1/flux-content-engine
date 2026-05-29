/**
 * Style mode loader — fetches a single style_modes row by key.
 *
 * Returns the JSON config block (typography + palette + layout + motion +
 * effects) shaped for the StyleModeOverlay the renderer consumes. Returns
 * null if the key isn't found — the composer falls back to brand theme.
 */
import { supabase } from '../../lib/supabase';
import { childLogger } from '../../lib/logger';
import type { StyleModeOverlay } from '../render/templates/minimal';

const log = childLogger({ module: 'style-loader' });

export async function loadStyleMode(
  orgId: string,
  key: string | null | undefined,
): Promise<StyleModeOverlay | null> {
  if (!key) return null;
  try {
    // Prefer per-org override; fall back to system row.
    const { data, error } = await supabase
      .from('style_modes')
      .select('typography, palette, layout, motion, effects')
      .eq('key', key)
      .or(`organization_id.eq.${orgId},organization_id.is.null`)
      .order('organization_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      typography: data.typography as StyleModeOverlay['typography'],
      palette: data.palette as StyleModeOverlay['palette'],
      layout: data.layout as StyleModeOverlay['layout'],
      effects: data.effects as StyleModeOverlay['effects'],
    };
  } catch (err) {
    log.warn({ key, err: (err as Error).message }, 'style mode load failed');
    return null;
  }
}
