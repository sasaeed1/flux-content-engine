/**
 * Auto-seed style modes on engine startup.
 *
 *   - If the `style_modes` table doesn't exist yet (migration not applied),
 *     log + skip (no error).
 *   - If it exists but has fewer than the expected number of system rows,
 *     upsert the missing ones.
 *   - If already fully seeded, skip silently.
 *
 * This lets users apply the Phase 1 SQL migration once, restart the engine,
 * and have the 40 modes auto-populate without running any external script.
 */
import { STYLE_MODES } from './styleModes';
import { supabase } from '../../lib/supabase';
import { childLogger } from '../../lib/logger';

const log = childLogger({ module: 'style-seed' });

export async function seedSystemStyleModes(): Promise<void> {
  // 1. Probe the table — graceful no-op if it doesn't exist yet.
  const probe = await supabase
    .from('style_modes')
    .select('key', { count: 'exact', head: true })
    .is('organization_id', null);

  if (probe.error) {
    // The migration hasn't been applied yet. That's fine — log + skip.
    if (probe.error.code === '42P01' || /relation .* does not exist/i.test(probe.error.message)) {
      log.info('style_modes table not found — skipping auto-seed (apply phase1 migration to enable)');
      return;
    }
    log.warn({ err: probe.error.message }, 'style_modes probe failed — skipping auto-seed');
    return;
  }

  const currentCount = probe.count ?? 0;
  if (currentCount >= STYLE_MODES.length) {
    log.debug({ count: currentCount }, 'style modes already seeded — skipping');
    return;
  }

  // 2. Upsert. Idempotent — `(organization_id NULL, key)` unique index handles
  //    re-runs cleanly. We still update fields so editing STYLE_MODES + a
  //    restart is enough to refresh visuals.
  let inserted = 0;
  let updated = 0;
  for (const m of STYLE_MODES) {
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

    const existing = await supabase
      .from('style_modes')
      .select('id')
      .is('organization_id', null)
      .eq('key', m.key)
      .maybeSingle();

    if (existing.error) continue;

    if (existing.data) {
      const upd = await supabase
        .from('style_modes')
        .update(payload)
        .eq('id', existing.data.id);
      if (!upd.error) updated += 1;
    } else {
      const ins = await supabase.from('style_modes').insert(payload);
      if (!ins.error) inserted += 1;
    }
  }
  log.info({ inserted, updated, total: STYLE_MODES.length }, 'style modes auto-seed complete');
}
