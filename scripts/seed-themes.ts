/**
 * Verify that theme presets + system templates are loaded in the DB.
 * (The actual seed lives in db/seed.sql — run it once in Supabase.)
 */
import { listThemes, listTemplatesForOrg } from '../src/db/repositories';
import { logger } from '../src/lib/logger';
import { toErrorMessage } from '../src/lib/errors';

async function main(): Promise<void> {
  const themes = await listThemes();
  logger.info({ count: themes.length }, 'theme_presets in DB');
  themes.forEach((t) => logger.info({ key: t.key, name: t.name, tone: t.visual_tone }));

  // System templates (org_id null) — pass the demo org so listTemplatesForOrg
  // returns them alongside any org-custom templates (none yet).
  const templates = await listTemplatesForOrg('00000000-0000-0000-0000-000000000000');
  logger.info({ count: templates.length }, 'templates visible to a fresh org');
  templates.forEach((t) =>
    logger.info({ key: t.key, type: t.type, system: t.is_system, slides: t.slide_count }),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ error: toErrorMessage(err) }, 'seed-themes verification failed');
    process.exit(1);
  });
