#!/usr/bin/env tsx
/**
 * Seed (or refresh) the 40 system-owned style modes into Supabase.
 *
 *   npm run seed:styles
 *
 * Idempotent — upserts by (organization_id=null, key). Safe to re-run after
 * editing STYLE_MODES.
 */
import { STYLE_MODES } from '../src/modules/styles/styleModes';
import { supabase } from '../src/lib/supabase';
import { logger } from '../src/lib/logger';

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const m of STYLE_MODES) {
    // Look up existing row (system-owned).
    const { data: existing } = await supabase
      .from('style_modes')
      .select('id')
      .is('organization_id', null)
      .eq('key', m.key)
      .maybeSingle();

    const payload = {
      organization_id: null,
      key: m.key,
      name: m.name,
      category: m.category,
      description: m.description,
      emotional_tone: m.emotional_tone,
      layout: m.layout,
      typography: m.typography,
      palette: m.palette,
      motion: m.motion,
      effects: m.effects,
      preview_url: m.preview_url ?? null,
      is_system: true,
      is_premium: m.is_premium ?? false,
    };

    if (existing) {
      const { error } = await supabase.from('style_modes').update(payload).eq('id', existing.id);
      if (error) {
        logger.error({ key: m.key, err: error.message }, 'update failed');
      } else {
        updated += 1;
      }
    } else {
      const { error } = await supabase.from('style_modes').insert(payload);
      if (error) {
        logger.error({ key: m.key, err: error.message }, 'insert failed');
      } else {
        inserted += 1;
      }
    }
  }
  logger.info({ inserted, updated, total: STYLE_MODES.length }, 'style modes seed complete');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
