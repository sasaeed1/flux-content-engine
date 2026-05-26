-- ============================================================
--  CONTENT ENGINE — Seed data
--  Run AFTER schema.sql. Idempotent.
--
--  Seeds:
--    - 9 system theme_presets (visual themes the app ships with)
--    - 1 demo organization + a default brand profile (for dev/testing)
--    - System carousel + single-post template stubs
-- ============================================================

-- ---------- theme_presets (system-wide visual themes) ----------
insert into theme_presets (key, name, description, visual_tone, colors, typography)
values
  ('minimal-startup', 'Minimal Startup',
   'Clean white background, bold black headlines, single accent colour.',
   'minimal',
   '{"background":"#FFFFFF","foreground":"#0A0A0A","muted":"#6B7280","accent":"#2563EB","accentSoft":"#DBEAFE"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Inter","weightDisplay":900,"weightBody":500,"sizeHook":92,"sizeBody":40}'::jsonb),

  ('dark-ai', 'Dark AI',
   'Near-black background, neon-cyan accent, mono display — futuristic AI vibe.',
   'futuristic',
   '{"background":"#08090C","foreground":"#F5F7FA","muted":"#9CA3AF","accent":"#22D3EE","accentSoft":"#0E7490"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"JetBrains Mono","weightDisplay":700,"weightBody":500,"sizeHook":88,"sizeBody":38}'::jsonb),

  ('luxury', 'Luxury',
   'Deep cream background, near-black text, fine serif display — premium feel.',
   'premium',
   '{"background":"#F4EFE6","foreground":"#171311","muted":"#5C544F","accent":"#7C5C2E","accentSoft":"#D9C9A5"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Playfair Display","weightDisplay":700,"weightBody":500,"sizeHook":86,"sizeBody":38}'::jsonb),

  ('corporate', 'Corporate',
   'Cool navy on light grey, conservative type — B2B / SaaS sales.',
   'professional',
   '{"background":"#F3F5F9","foreground":"#0C1B3A","muted":"#5B6B85","accent":"#1E40AF","accentSoft":"#DBEAFE"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Inter","weightDisplay":800,"weightBody":500,"sizeHook":84,"sizeBody":38}'::jsonb),

  ('modern-saas', 'Modern SaaS',
   'Soft gradient background, vivid violet accent — modern product marketing.',
   'modern',
   '{"background":"#FAFAFF","foreground":"#0F0F23","muted":"#6B6B85","accent":"#7C3AED","accentSoft":"#EDE9FE","gradientFrom":"#A78BFA","gradientTo":"#22D3EE"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Inter","weightDisplay":900,"weightBody":500,"sizeHook":92,"sizeBody":40}'::jsonb),

  ('motivational', 'Motivational',
   'Warm gradient, bold uppercase headlines — hype/coaching content.',
   'hyped',
   '{"background":"#1A0B0F","foreground":"#FFFFFF","muted":"#FCA5A5","accent":"#F97316","accentSoft":"#FB923C","gradientFrom":"#7F1D1D","gradientTo":"#0B0B14"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Inter","weightDisplay":900,"weightBody":600,"sizeHook":100,"sizeBody":42}'::jsonb),

  ('cyberpunk', 'Cyberpunk',
   'Black background, magenta + cyan glow — high-contrast tech-edge.',
   'cyber',
   '{"background":"#05050A","foreground":"#F0F0F5","muted":"#94A3B8","accent":"#EC4899","accentSoft":"#22D3EE","glow":"#EC4899"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"JetBrains Mono","weightDisplay":800,"weightBody":500,"sizeHook":88,"sizeBody":38}'::jsonb),

  ('documentary', 'Documentary',
   'Filmic dark grey, off-white headlines, restrained accent — long-form/story.',
   'editorial',
   '{"background":"#14171B","foreground":"#F1EDE4","muted":"#8B8B82","accent":"#D4A24C","accentSoft":"#A07A2C"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Playfair Display","weightDisplay":700,"weightBody":500,"sizeHook":82,"sizeBody":38}'::jsonb),

  ('minimal-bw', 'Minimal Black/White',
   'Pure black/white, no accents — strongest possible typographic statement.',
   'minimal',
   '{"background":"#FFFFFF","foreground":"#000000","muted":"#525252","accent":"#000000","accentSoft":"#E5E5E5"}'::jsonb,
   '{"fontPrimary":"Inter","fontDisplay":"Inter","weightDisplay":900,"weightBody":500,"sizeHook":100,"sizeBody":42}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  visual_tone = excluded.visual_tone,
  colors = excluded.colors,
  typography = excluded.typography;

-- ---------- system templates (no organization_id) ----------
insert into templates (organization_id, name, key, type, slide_count, is_system, definition)
values
  (null, 'Educational Carousel', 'carousel.educational.v1', 'carousel', 7, true,
   '{
      "kind": "carousel",
      "slides": [
        { "role": "hook",     "layout": "title-hook",        "slots": ["title","subtitle"] },
        { "role": "content",  "layout": "stat-callout",      "slots": ["title","body","number"] },
        { "role": "content",  "layout": "two-column-list",   "slots": ["title","items"] },
        { "role": "content",  "layout": "single-quote",      "slots": ["body","attribution"] },
        { "role": "content",  "layout": "step",              "slots": ["title","body","step"] },
        { "role": "content",  "layout": "step",              "slots": ["title","body","step"] },
        { "role": "cta",      "layout": "cta-action",        "slots": ["title","cta","handle"] }
      ],
      "renderer": "html-puppeteer",
      "htmlTemplate": "minimal-carousel"
    }'::jsonb),

  (null, 'Quote Post', 'single.quote.v1', 'quote', 1, true,
   '{
      "kind": "single",
      "slides": [
        { "role": "quote", "layout": "centered-quote", "slots": ["body","attribution"] }
      ],
      "renderer": "html-puppeteer",
      "htmlTemplate": "minimal-quote"
    }'::jsonb),

  (null, 'CTA Post', 'single.cta.v1', 'cta', 1, true,
   '{
      "kind": "single",
      "slides": [
        { "role": "cta", "layout": "title-cta", "slots": ["title","subtitle","cta"] }
      ],
      "renderer": "html-puppeteer",
      "htmlTemplate": "minimal-single"
    }'::jsonb)
on conflict do nothing;

-- ---------- demo organization for local testing ----------
insert into organizations (id, name, slug, api_key, subscription_tier, ai_provider, metadata)
values (
  '11111111-1111-1111-1111-111111111111',
  'Demo Org',
  'demo',
  'org_demo_b091cdbdf085ca2a',
  'free',
  'groq',
  '{"note":"Created by seed.sql for local testing. Rotate the api_key for production."}'::jsonb
)
on conflict (id) do nothing;

-- ---------- default brand profile for the demo org ----------
insert into brand_profiles (
  organization_id, name, theme_preset_id, niche, business_type, tone, post_style,
  cta_style, voice_keywords, is_default
)
select
  '11111111-1111-1111-1111-111111111111',
  'Demo Default Brand',
  tp.id,
  'AI & business automation',
  'SMB consulting / agency',
  'expert',
  'educational',
  'follow @demo for more',
  array['concrete','specific','no fluff','confident'],
  true
from theme_presets tp where tp.key = 'minimal-startup'
on conflict do nothing;
