/**
 * Seed the multi-tenant DB via the Supabase REST API.
 * Idempotent: safe to re-run.
 *
 *   npx tsx scripts/seed-rest.ts
 */
import { supabase } from '../src/lib/supabase';
import { logger } from '../src/lib/logger';
import { toErrorMessage } from '../src/lib/errors';

const DEMO_ORG_ID = '11111111-1111-1111-1111-111111111111';
const DEMO_API_KEY = 'org_demo_b091cdbdf085ca2a';

const themes = [
  {
    key: 'minimal-startup',
    name: 'Minimal Startup',
    description: 'Clean white background, bold black headlines, single accent colour.',
    visual_tone: 'minimal',
    colors: { background: '#FFFFFF', foreground: '#0A0A0A', muted: '#6B7280', accent: '#2563EB', accentSoft: '#DBEAFE' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Inter', weightDisplay: 900, weightBody: 500, sizeHook: 92, sizeBody: 40 },
  },
  {
    key: 'dark-ai',
    name: 'Dark AI',
    description: 'Near-black background, neon-cyan accent, mono display.',
    visual_tone: 'futuristic',
    colors: { background: '#08090C', foreground: '#F5F7FA', muted: '#9CA3AF', accent: '#22D3EE', accentSoft: '#0E7490' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'JetBrains Mono', weightDisplay: 700, weightBody: 500, sizeHook: 88, sizeBody: 38 },
  },
  {
    key: 'luxury',
    name: 'Luxury',
    description: 'Cream background, dark text, fine serif display.',
    visual_tone: 'premium',
    colors: { background: '#F4EFE6', foreground: '#171311', muted: '#5C544F', accent: '#7C5C2E', accentSoft: '#D9C9A5' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Playfair Display', weightDisplay: 700, weightBody: 500, sizeHook: 86, sizeBody: 38 },
  },
  {
    key: 'corporate',
    name: 'Corporate',
    description: 'Navy on light grey, conservative — B2B / SaaS sales.',
    visual_tone: 'professional',
    colors: { background: '#F3F5F9', foreground: '#0C1B3A', muted: '#5B6B85', accent: '#1E40AF', accentSoft: '#DBEAFE' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Inter', weightDisplay: 800, weightBody: 500, sizeHook: 84, sizeBody: 38 },
  },
  {
    key: 'modern-saas',
    name: 'Modern SaaS',
    description: 'Soft gradient background, vivid violet accent.',
    visual_tone: 'modern',
    colors: { background: '#FAFAFF', foreground: '#0F0F23', muted: '#6B6B85', accent: '#7C3AED', accentSoft: '#EDE9FE', gradientFrom: '#A78BFA', gradientTo: '#22D3EE' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Inter', weightDisplay: 900, weightBody: 500, sizeHook: 92, sizeBody: 40 },
  },
  {
    key: 'motivational',
    name: 'Motivational',
    description: 'Warm gradient, bold uppercase headlines.',
    visual_tone: 'hyped',
    colors: { background: '#1A0B0F', foreground: '#FFFFFF', muted: '#FCA5A5', accent: '#F97316', accentSoft: '#FB923C', gradientFrom: '#7F1D1D', gradientTo: '#0B0B14' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Inter', weightDisplay: 900, weightBody: 600, sizeHook: 100, sizeBody: 42 },
  },
  {
    key: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Black background, magenta + cyan glow.',
    visual_tone: 'cyber',
    colors: { background: '#05050A', foreground: '#F0F0F5', muted: '#94A3B8', accent: '#EC4899', accentSoft: '#22D3EE', glow: '#EC4899' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'JetBrains Mono', weightDisplay: 800, weightBody: 500, sizeHook: 88, sizeBody: 38 },
  },
  {
    key: 'documentary',
    name: 'Documentary',
    description: 'Filmic dark grey, off-white headlines, restrained accent.',
    visual_tone: 'editorial',
    colors: { background: '#14171B', foreground: '#F1EDE4', muted: '#8B8B82', accent: '#D4A24C', accentSoft: '#A07A2C' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Playfair Display', weightDisplay: 700, weightBody: 500, sizeHook: 82, sizeBody: 38 },
  },
  {
    key: 'minimal-bw',
    name: 'Minimal Black/White',
    description: 'Pure black/white, no accents — strongest typographic statement.',
    visual_tone: 'minimal',
    colors: { background: '#FFFFFF', foreground: '#000000', muted: '#525252', accent: '#000000', accentSoft: '#E5E5E5' },
    typography: { fontPrimary: 'Inter', fontDisplay: 'Inter', weightDisplay: 900, weightBody: 500, sizeHook: 100, sizeBody: 42 },
  },
];

const templates = [
  {
    name: 'Educational Carousel',
    key: 'carousel.educational.v1',
    type: 'carousel',
    slide_count: 7,
    is_system: true,
    definition: {
      kind: 'carousel',
      renderer: 'html-puppeteer',
      htmlTemplate: 'minimal-carousel',
      slides: [
        { role: 'hook', layout: 'title-hook', slots: ['title', 'subtitle'] },
        { role: 'content', layout: 'stat-callout', slots: ['title', 'body', 'number'] },
        { role: 'content', layout: 'two-column-list', slots: ['title', 'items'] },
        { role: 'content', layout: 'single-quote', slots: ['body', 'attribution'] },
        { role: 'content', layout: 'step', slots: ['title', 'body', 'step'] },
        { role: 'content', layout: 'step', slots: ['title', 'body', 'step'] },
        { role: 'cta', layout: 'cta-action', slots: ['title', 'cta', 'handle'] },
      ],
    },
  },
  {
    name: 'Quote Post',
    key: 'single.quote.v1',
    type: 'quote',
    slide_count: 1,
    is_system: true,
    definition: {
      kind: 'single',
      renderer: 'html-puppeteer',
      htmlTemplate: 'minimal-quote',
      slides: [{ role: 'quote', layout: 'centered-quote', slots: ['body', 'attribution'] }],
    },
  },
  {
    name: 'CTA Post',
    key: 'single.cta.v1',
    type: 'cta',
    slide_count: 1,
    is_system: true,
    definition: {
      kind: 'single',
      renderer: 'html-puppeteer',
      htmlTemplate: 'minimal-single',
      slides: [{ role: 'cta', layout: 'title-cta', slots: ['title', 'subtitle', 'cta'] }],
    },
  },
];

async function main(): Promise<void> {
  /* 1. themes — upsert on unique key */
  const { error: tErr } = await supabase.from('theme_presets').upsert(themes, { onConflict: 'key' });
  if (tErr) throw new Error('theme_presets: ' + tErr.message);
  logger.info({ count: themes.length }, 'theme_presets seeded');

  /* 2. system templates — check-then-insert (partial unique index can't onConflict cleanly) */
  for (const tpl of templates) {
    const { data: existing } = await supabase
      .from('templates')
      .select('id')
      .is('organization_id', null)
      .eq('key', tpl.key)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from('templates').update(tpl).eq('id', existing.id);
      if (error) throw new Error(`templates(${tpl.key}): ${error.message}`);
    } else {
      const { error } = await supabase
        .from('templates')
        .insert({ ...tpl, organization_id: null });
      if (error) throw new Error(`templates(${tpl.key}): ${error.message}`);
    }
  }
  logger.info({ count: templates.length }, 'system templates seeded');

  /* 3. demo org — upsert on id */
  const { error: oErr } = await supabase.from('organizations').upsert(
    {
      id: DEMO_ORG_ID,
      name: 'Demo Org',
      slug: 'demo',
      api_key: DEMO_API_KEY,
      subscription_tier: 'free',
      ai_provider: 'groq',
      active: true,
      metadata: { note: 'Created by seed-rest.ts for local testing.' },
    },
    { onConflict: 'id' },
  );
  if (oErr) throw new Error('organizations: ' + oErr.message);
  logger.info({ orgId: DEMO_ORG_ID, apiKey: DEMO_API_KEY }, 'demo organization seeded');

  /* 4. default brand for demo org — check-then-insert */
  const { data: minimal, error: mErr } = await supabase
    .from('theme_presets')
    .select('id')
    .eq('key', 'minimal-startup')
    .single();
  if (mErr || !minimal) throw new Error('lookup minimal-startup theme: ' + (mErr?.message ?? 'not found'));

  const { data: existingBrand } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('organization_id', DEMO_ORG_ID)
    .eq('is_default', true)
    .maybeSingle();

  if (!existingBrand) {
    const { error: bErr } = await supabase.from('brand_profiles').insert({
      organization_id: DEMO_ORG_ID,
      name: 'Demo Default Brand',
      theme_preset_id: minimal.id,
      niche: 'AI & business automation',
      business_type: 'SMB consulting / agency',
      tone: 'expert',
      post_style: 'educational',
      cta_style: 'follow @demo for more',
      voice_keywords: ['concrete', 'specific', 'no fluff', 'confident'],
      is_default: true,
    });
    if (bErr) throw new Error('brand_profiles: ' + bErr.message);
    logger.info('demo brand_profile created');
  } else {
    logger.info({ id: existingBrand.id }, 'demo brand_profile already exists — skipped');
  }

  logger.info('SEED COMPLETE');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ error: toErrorMessage(err) }, 'seed-rest failed');
    process.exit(1);
  });
