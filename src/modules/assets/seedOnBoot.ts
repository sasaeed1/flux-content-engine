/**
 * Asset library seeder — runs once at engine boot.
 *
 * Registers a `asset_library` row for each system overlay/texture defined in
 * systemAssets.ts so the UI's eventual asset browser can list them and the
 * loader can join against the table. The SVG payload itself stays in code —
 * the row is purely a discoverability record (storage_path/public_url NULL).
 *
 * Idempotent: an `is_system=true AND name=key` lookup gates each insert.
 */
import { supabase } from '../../lib/supabase';
import { childLogger } from '../../lib/logger';
import { SYSTEM_ASSETS } from './systemAssets';

const log = childLogger({ module: 'asset-seed' });

export async function seedSystemAssets(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // One round-trip — fetch all current system asset keys.
  const { data: existing, error: lookupErr } = await supabase
    .from('asset_library')
    .select('name')
    .is('organization_id', null)
    .eq('is_system', true);
  if (lookupErr) {
    log.warn({ err: lookupErr.message }, 'asset_library lookup failed — skipping seed');
    return { inserted, skipped };
  }
  const have = new Set((existing ?? []).map((r) => (r as { name: string }).name));

  const toInsert = SYSTEM_ASSETS.filter((a) => !have.has(a.key)).map((a) => ({
    organization_id: null,
    kind: a.kind,
    name: a.key,
    storage_path: null,
    public_url: null,
    metadata: {
      display_name: a.name,
      opacity: a.opacity ?? null,
      blend_mode: a.blendMode ?? null,
      tile_size: a.tileSize ?? null,
      source: 'code',
    } as Record<string, unknown>,
    is_system: true,
    is_premium: false,
  }));

  if (toInsert.length === 0) {
    skipped = SYSTEM_ASSETS.length;
    log.info({ count: skipped }, 'All system assets already seeded');
    return { inserted, skipped };
  }

  const { error: insErr } = await supabase.from('asset_library').insert(toInsert);
  if (insErr) {
    log.warn({ err: insErr.message }, 'asset_library seed insert failed');
    return { inserted, skipped: SYSTEM_ASSETS.length };
  }
  inserted = toInsert.length;
  skipped = SYSTEM_ASSETS.length - inserted;
  log.info({ inserted, skipped }, 'System assets seeded');
  return { inserted, skipped };
}
