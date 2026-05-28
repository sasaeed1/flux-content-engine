/**
 * 40 premium style modes — the visual personality matrix.
 *
 * Each mode is a deterministic JSON document the renderer reads to drive:
 *   - typography (primary + display fonts, weights, sizes, tracking)
 *   - palette (background, foreground, accents, gradients)
 *   - layout (grid, padding, hierarchy bias)
 *   - motion (philosophy + intensity for the future motion engine)
 *   - effects (grain, glow, blur — switches for the renderer)
 *
 * These are seeded into `style_modes` (system-owned rows, organization_id
 * NULL) on engine boot via seedStyleModes(). Per-org custom modes can be
 * added later — same shape, organization_id set.
 */

export interface StyleMode {
  key: string;
  name: string;
  category:
    | 'minimal'
    | 'editorial'
    | 'luxury'
    | 'tech'
    | 'corporate'
    | 'playful'
    | 'cinematic'
    | 'cultural';
  description: string;
  emotional_tone: string;
  typography: {
    primary: string;
    display: string;
    weight_body: number;
    weight_display: number;
    hook_size: number; // px at 1080×1080
    body_size: number;
    tracking: string; // e.g. '-0.02em', '0.06em'
  };
  palette: {
    background: string;
    foreground: string;
    muted: string;
    accent: string;
    accent_soft: string;
    gradient?: string[]; // optional multi-stop gradient
  };
  layout: {
    grid: 'centered' | 'asymmetric' | 'split' | 'editorial' | 'magazine' | 'poster';
    padding: 'tight' | 'standard' | 'generous' | 'luxurious';
    hierarchy: 'subtle' | 'standard' | 'dramatic' | 'extreme';
  };
  motion: {
    philosophy: 'still' | 'subtle' | 'dynamic' | 'cinematic' | 'kinetic';
    intensity: number; // 0..1
  };
  effects: {
    grain?: number;        // 0..1
    glow?: number;         // 0..1
    blur?: number;         // 0..1
    vignette?: number;     // 0..1
    overlay?: string;      // texture name
  };
  preview_url?: string;
  is_premium?: boolean;
}

const M = (
  key: string,
  name: string,
  category: StyleMode['category'],
  partial: Partial<Omit<StyleMode, 'key' | 'name' | 'category'>>,
): StyleMode => ({
  key,
  name,
  category,
  description: partial.description ?? '',
  emotional_tone: partial.emotional_tone ?? 'confident',
  typography: {
    primary: 'Inter',
    display: 'Inter',
    weight_body: 500,
    weight_display: 900,
    hook_size: 92,
    body_size: 40,
    tracking: '-0.02em',
    ...(partial.typography ?? {}),
  },
  palette: {
    background: '#0a0a0a',
    foreground: '#ffffff',
    muted: '#a3a3a3',
    accent: '#22d3ee',
    accent_soft: '#22d3ee20',
    ...(partial.palette ?? {}),
  },
  layout: {
    grid: 'centered',
    padding: 'standard',
    hierarchy: 'standard',
    ...(partial.layout ?? {}),
  },
  motion: {
    philosophy: 'subtle',
    intensity: 0.3,
    ...(partial.motion ?? {}),
  },
  effects: partial.effects ?? {},
  preview_url: partial.preview_url,
  is_premium: partial.is_premium ?? false,
});

export const STYLE_MODES: StyleMode[] = [
  M('luxury-black', 'Luxury Black', 'luxury', {
    description: 'Pure black canvas, gold accent, restrained type. Premium real-estate / private banking.',
    emotional_tone: 'aspirational',
    typography: { primary: 'Playfair Display', display: 'Playfair Display', weight_display: 700, hook_size: 88, body_size: 38, tracking: '-0.01em', weight_body: 400 },
    palette: { background: '#0a0a0a', foreground: '#f5f5f4', muted: '#a8a29e', accent: '#d4af37', accent_soft: '#d4af3720', gradient: ['#0a0a0a', '#1a1a1a'] },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'cinematic', intensity: 0.5 },
    effects: { vignette: 0.4, grain: 0.15 },
    is_premium: true,
  }),
  M('cyberpunk-neon', 'Cyberpunk Neon', 'tech', {
    description: 'Deep blacks with magenta + cyan glows. Game-adjacent, futuristic, neon-drenched.',
    emotional_tone: 'energetic',
    typography: { primary: 'JetBrains Mono', display: 'JetBrains Mono', weight_display: 800, weight_body: 500, hook_size: 96, body_size: 38, tracking: '0.04em' },
    palette: { background: '#0b0014', foreground: '#f0abfc', muted: '#7c3aed', accent: '#22d3ee', accent_soft: '#22d3ee25', gradient: ['#0b0014', '#1a0033', '#0b0014'] },
    layout: { grid: 'asymmetric', padding: 'standard', hierarchy: 'dramatic' },
    motion: { philosophy: 'kinetic', intensity: 0.85 },
    effects: { glow: 0.7, grain: 0.2 },
  }),
  M('startup-minimal', 'Startup Minimal', 'minimal', {
    description: 'Clean off-white, gentle gray accents, sans-serif. The default for modern SaaS.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 84, body_size: 38, tracking: '-0.02em' },
    palette: { background: '#fafafa', foreground: '#0a0a0a', muted: '#737373', accent: '#262626', accent_soft: '#26262615' },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.25 },
  }),
  M('apple-minimal', 'Apple-Inspired Minimal', 'minimal', {
    description: 'Generous whitespace, light system fonts, perfectly centered hierarchy. Cupertino energy.',
    typography: { primary: 'SF Pro Display', display: 'SF Pro Display', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 36, tracking: '-0.03em' },
    palette: { background: '#ffffff', foreground: '#1d1d1f', muted: '#86868b', accent: '#0071e3', accent_soft: '#0071e312' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'subtle', intensity: 0.2 },
  }),
  M('modern-corporate', 'Modern Corporate', 'corporate', {
    description: 'Navy + light grey, conservative sans. B2B SaaS, finance, consulting.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 800, weight_body: 500, hook_size: 86, body_size: 38, tracking: '-0.02em' },
    palette: { background: '#f4f6f8', foreground: '#0f172a', muted: '#64748b', accent: '#1e40af', accent_soft: '#1e40af18' },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.3 },
  }),
  M('brutalist-editorial', 'Brutalist Editorial', 'editorial', {
    description: 'Massive type, broken grids, raw aesthetics. Design-forward zine energy.',
    emotional_tone: 'confrontational',
    typography: { primary: 'Helvetica', display: 'Helvetica', weight_display: 900, weight_body: 500, hook_size: 120, body_size: 32, tracking: '-0.04em' },
    palette: { background: '#fffbeb', foreground: '#0a0a0a', muted: '#a16207', accent: '#dc2626', accent_soft: '#dc262615' },
    layout: { grid: 'asymmetric', padding: 'tight', hierarchy: 'extreme' },
    motion: { philosophy: 'kinetic', intensity: 0.8 },
    is_premium: true,
  }),
  M('high-fashion-magazine', 'High Fashion Magazine', 'editorial', {
    description: 'Cream backgrounds, gigantic serif display, fashion-spread layouts.',
    typography: { primary: 'EB Garamond', display: 'Bodoni Moda', weight_display: 800, weight_body: 400, hook_size: 110, body_size: 30, tracking: '-0.04em' },
    palette: { background: '#f4f0e8', foreground: '#1a1a1a', muted: '#71717a', accent: '#7c2d12', accent_soft: '#7c2d1215' },
    layout: { grid: 'magazine', padding: 'luxurious', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.45 },
    effects: { grain: 0.18 },
    is_premium: true,
  }),
  M('dark-academia', 'Dark Academia', 'editorial', {
    description: 'Aged paper feel, serif display, deep oxblood + ink tones.',
    typography: { primary: 'EB Garamond', display: 'Cormorant Garamond', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 32, tracking: '-0.01em' },
    palette: { background: '#1c1917', foreground: '#fafaf9', muted: '#a8a29e', accent: '#a16207', accent_soft: '#a1620718' },
    layout: { grid: 'editorial', padding: 'generous', hierarchy: 'dramatic' },
    motion: { philosophy: 'still', intensity: 0.1 },
    effects: { grain: 0.3, vignette: 0.35 },
  }),
  M('islamic-elegant', 'Islamic Elegant', 'cultural', {
    description: 'Deep emerald + ivory + gold geometric trim. Reverent, ornate, calm.',
    typography: { primary: 'Cormorant Garamond', display: 'Cormorant Garamond', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 34, tracking: '0.01em' },
    palette: { background: '#fdfaf3', foreground: '#0f3a2e', muted: '#6b7280', accent: '#b8860b', accent_soft: '#b8860b18' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.15 },
    effects: { overlay: 'islamic-geometric' },
    is_premium: true,
  }),
  M('futuristic-ai', 'Futuristic AI', 'tech', {
    description: 'Iridescent gradients, holographic panels, ethereal type. AI-startup energy.',
    typography: { primary: 'Inter', display: 'Space Grotesk', weight_display: 700, weight_body: 500, hook_size: 92, body_size: 38, tracking: '-0.03em' },
    palette: { background: '#0a0a13', foreground: '#fafafa', muted: '#a5b4fc', accent: '#a78bfa', accent_soft: '#a78bfa25', gradient: ['#0a0a13', '#1e1b4b', '#312e81'] },
    layout: { grid: 'asymmetric', padding: 'standard', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.7 },
    effects: { glow: 0.5, blur: 0.2 },
  }),
  M('saas-dashboard', 'SaaS Dashboard', 'tech', {
    description: 'Indigo + violet + slate. Linear/Notion/Stripe palette territory.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 84, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#0f0f17', foreground: '#fafafa', muted: '#71717a', accent: '#6366f1', accent_soft: '#6366f120', gradient: ['#0f0f17', '#1e1b4b'] },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.35 },
  }),
  M('glassmorphism', 'Glassmorphism', 'tech', {
    description: 'Translucent panels, frosted blur, soft pastel gradients. Apple Vision Pro vibe.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 84, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#1e1b4b', foreground: '#fafafa', muted: '#c7d2fe', accent: '#a5b4fc', accent_soft: '#a5b4fc20', gradient: ['#1e1b4b', '#5b21b6', '#1e1b4b'] },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'standard' },
    motion: { philosophy: 'dynamic', intensity: 0.55 },
    effects: { blur: 0.6, glow: 0.4 },
  }),
  M('retro-90s-tech', 'Retro 90s Tech', 'tech', {
    description: 'CRT scanlines, terminal greens, pixel headers. Nostalgic for early Web.',
    typography: { primary: 'IBM Plex Mono', display: 'IBM Plex Mono', weight_display: 700, weight_body: 500, hook_size: 86, body_size: 32, tracking: '0.04em' },
    palette: { background: '#0a0a0a', foreground: '#22c55e', muted: '#65a30d', accent: '#fef08a', accent_soft: '#fef08a18' },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'standard' },
    motion: { philosophy: 'kinetic', intensity: 0.6 },
    effects: { grain: 0.4, overlay: 'crt-scanlines' },
  }),
  M('clean-educational', 'Clean Educational', 'minimal', {
    description: 'Soft pastel accents, friendly sans, generous spacing. Course-creator default.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 84, body_size: 38, tracking: '-0.02em' },
    palette: { background: '#fefce8', foreground: '#1c1917', muted: '#a8a29e', accent: '#ea580c', accent_soft: '#ea580c18' },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.3 },
  }),
  M('high-contrast-bold', 'High Contrast Bold', 'playful', {
    description: 'Two-color slap-you-in-the-face palette. Stops the scroll instantly.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 600, hook_size: 110, body_size: 40, tracking: '-0.04em' },
    palette: { background: '#fbbf24', foreground: '#0a0a0a', muted: '#a16207', accent: '#dc2626', accent_soft: '#dc262625' },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'dramatic' },
    motion: { philosophy: 'kinetic', intensity: 0.85 },
  }),
  M('minimal-monochrome', 'Minimal Monochrome', 'minimal', {
    description: 'Single-hue greyscale, perfect type hierarchy. Editorial restraint.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 800, weight_body: 500, hook_size: 88, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#fafafa', foreground: '#0a0a0a', muted: '#a3a3a3', accent: '#525252', accent_soft: '#52525218' },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.15 },
  }),
  M('japanese-zen', 'Japanese Zen', 'minimal', {
    description: 'Ink black on rice paper. Deep negative space, vertical hierarchy.',
    typography: { primary: 'Noto Serif JP', display: 'Noto Serif JP', weight_display: 600, weight_body: 400, hook_size: 80, body_size: 32, tracking: '0.06em' },
    palette: { background: '#f5f5f4', foreground: '#1c1917', muted: '#78716c', accent: '#7f1d1d', accent_soft: '#7f1d1d15' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.1 },
    is_premium: true,
  }),
  M('scandinavian-minimal', 'Scandinavian Minimal', 'minimal', {
    description: 'Off-white, oat, charcoal. Light Nordic restraint.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#f5f5f1', foreground: '#27272a', muted: '#a1a1aa', accent: '#3f3f46', accent_soft: '#3f3f4615' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.15 },
  }),
  M('wealth-aesthetic', 'Wealth Aesthetic', 'luxury', {
    description: 'Cream + champagne + bronze, serif display. Old-money signaling.',
    typography: { primary: 'Cormorant Garamond', display: 'Cormorant Garamond', weight_display: 700, weight_body: 400, hook_size: 90, body_size: 34, tracking: '-0.01em' },
    palette: { background: '#f5f0e1', foreground: '#1c1917', muted: '#78716c', accent: '#92400e', accent_soft: '#92400e18' },
    layout: { grid: 'editorial', padding: 'luxurious', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.4 },
    is_premium: true,
  }),
  M('finance-bro-premium', 'Finance Bro Premium', 'luxury', {
    description: 'Charcoal + gold, slab-serif headlines. Hedge-fund newsletter energy.',
    typography: { primary: 'Inter', display: 'Roboto Slab', weight_display: 800, weight_body: 500, hook_size: 90, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#0c0a09', foreground: '#fef3c7', muted: '#a8a29e', accent: '#d4a017', accent_soft: '#d4a01720' },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.5 },
    effects: { grain: 0.15 },
  }),
  M('tactical-masculine', 'Tactical Masculine', 'luxury', {
    description: 'Gunmetal + olive + amber. Military-precision typography.',
    typography: { primary: 'Inter', display: 'Roboto Condensed', weight_display: 800, weight_body: 600, hook_size: 92, body_size: 36, tracking: '0.04em' },
    palette: { background: '#171717', foreground: '#fafafa', muted: '#737373', accent: '#65a30d', accent_soft: '#65a30d20' },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'dramatic' },
    motion: { philosophy: 'dynamic', intensity: 0.6 },
  }),
  M('soft-feminine-luxury', 'Soft Feminine Luxury', 'luxury', {
    description: 'Blush + rose-gold + cream. Editorial serif + airy whitespace.',
    typography: { primary: 'Cormorant Garamond', display: 'Cormorant Garamond', weight_display: 600, weight_body: 400, hook_size: 88, body_size: 34, tracking: '-0.01em' },
    palette: { background: '#fef2f2', foreground: '#581c1c', muted: '#9f1239', accent: '#be185d', accent_soft: '#be185d18' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.3 },
  }),
  M('creator-economy', 'Creator Economy', 'playful', {
    description: 'Bright gradients, oversized type, energetic. Built for IG/TikTok creators.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 600, hook_size: 100, body_size: 38, tracking: '-0.03em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#a3a3a3', accent: '#ec4899', accent_soft: '#ec489920', gradient: ['#ec4899', '#a855f7', '#3b82f6'] },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'dramatic' },
    motion: { philosophy: 'kinetic', intensity: 0.8 },
    effects: { glow: 0.5 },
  }),
  M('youtube-thumbnail-energy', 'YouTube Thumbnail Energy', 'playful', {
    description: 'Maximum contrast, drop-shadow text, arrow + circle annotations.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 700, hook_size: 120, body_size: 40, tracking: '-0.04em' },
    palette: { background: '#dc2626', foreground: '#fefce8', muted: '#fca5a5', accent: '#fbbf24', accent_soft: '#fbbf2425' },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'extreme' },
    motion: { philosophy: 'kinetic', intensity: 0.95 },
  }),
  M('cinematic-poster', 'Cinematic Movie Poster', 'cinematic', {
    description: 'Movie poster blacks, single-color spotlight, condensed type.',
    typography: { primary: 'Bebas Neue', display: 'Bebas Neue', weight_display: 700, weight_body: 500, hook_size: 130, body_size: 36, tracking: '0.04em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#a3a3a3', accent: '#facc15', accent_soft: '#facc1520', gradient: ['#0a0a0a', '#1a1a1a'] },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'extreme' },
    motion: { philosophy: 'cinematic', intensity: 0.85 },
    effects: { vignette: 0.5, grain: 0.25 },
    is_premium: true,
  }),
  M('hacker-terminal', 'Hacker Terminal', 'tech', {
    description: 'Solid black + matrix green. Monospace, scanlines, CRT glow.',
    typography: { primary: 'JetBrains Mono', display: 'JetBrains Mono', weight_display: 700, weight_body: 500, hook_size: 80, body_size: 30, tracking: '0.04em' },
    palette: { background: '#000000', foreground: '#22c55e', muted: '#16a34a', accent: '#86efac', accent_soft: '#86efac18' },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'standard' },
    motion: { philosophy: 'kinetic', intensity: 0.7 },
    effects: { overlay: 'crt-scanlines', glow: 0.5 },
  }),
  M('swiss-design-grid', 'Swiss Design Grid', 'editorial', {
    description: 'Rigid grid, Helvetica, primary color blocks. International typographic style.',
    typography: { primary: 'Helvetica', display: 'Helvetica', weight_display: 800, weight_body: 500, hook_size: 92, body_size: 32, tracking: '-0.02em' },
    palette: { background: '#fafafa', foreground: '#0a0a0a', muted: '#737373', accent: '#dc2626', accent_soft: '#dc262615' },
    layout: { grid: 'split', padding: 'standard', hierarchy: 'standard' },
    motion: { philosophy: 'still', intensity: 0.2 },
  }),
  M('futuristic-holographic', 'Futuristic Holographic', 'tech', {
    description: 'Iridescent foil gradients, mirrored type. Apple Watch face energy.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 800, weight_body: 500, hook_size: 92, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#0a0a13', foreground: '#fafafa', muted: '#a5b4fc', accent: '#22d3ee', accent_soft: '#22d3ee20', gradient: ['#a78bfa', '#22d3ee', '#ec4899'] },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.75 },
    effects: { glow: 0.65 },
    is_premium: true,
  }),
  M('modern-newsroom', 'Modern Newsroom', 'editorial', {
    description: 'NYT-aesthetic. Serif display, beige paper, restrained color.',
    typography: { primary: 'EB Garamond', display: 'EB Garamond', weight_display: 700, weight_body: 400, hook_size: 88, body_size: 32, tracking: '-0.01em' },
    palette: { background: '#fefce8', foreground: '#1c1917', muted: '#78716c', accent: '#7f1d1d', accent_soft: '#7f1d1d15' },
    layout: { grid: 'magazine', padding: 'generous', hierarchy: 'dramatic' },
    motion: { philosophy: 'still', intensity: 0.15 },
  }),
  M('ai-research-lab', 'AI Research Lab', 'tech', {
    description: 'Anthropic/OpenAI aesthetic. Serif-meets-mono, ample whitespace, thinky.',
    typography: { primary: 'EB Garamond', display: 'Inter', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#fafafa', foreground: '#1c1917', muted: '#78716c', accent: '#ca8a04', accent_soft: '#ca8a0418' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.2 },
  }),
  M('silicon-valley-founder', 'Silicon Valley Founder', 'corporate', {
    description: 'Founder-friendly neutrals, Inter, tight grid. YC application energy.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 80, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#fafafa', foreground: '#0a0a0a', muted: '#525252', accent: '#f97316', accent_soft: '#f9731618' },
    layout: { grid: 'centered', padding: 'standard', hierarchy: 'standard' },
    motion: { philosophy: 'subtle', intensity: 0.25 },
  }),
  M('luxury-real-estate', 'Luxury Real Estate', 'luxury', {
    description: 'Marble white, deep teal, gold. Listing-magazine aesthetic.',
    typography: { primary: 'Cormorant Garamond', display: 'Cormorant Garamond', weight_display: 700, weight_body: 400, hook_size: 90, body_size: 34, tracking: '-0.01em' },
    palette: { background: '#f5f0e1', foreground: '#0f3a4a', muted: '#475569', accent: '#b8860b', accent_soft: '#b8860b18' },
    layout: { grid: 'editorial', padding: 'luxurious', hierarchy: 'dramatic' },
    motion: { philosophy: 'cinematic', intensity: 0.45 },
    is_premium: true,
  }),
  M('high-end-ecommerce', 'High-End Ecommerce', 'luxury', {
    description: 'Mute pastels, sharp serif headlines. Aesop/Glossier energy.',
    typography: { primary: 'Cormorant Garamond', display: 'Cormorant Garamond', weight_display: 600, weight_body: 400, hook_size: 88, body_size: 32, tracking: '-0.01em' },
    palette: { background: '#f8f5f1', foreground: '#1c1917', muted: '#a8a29e', accent: '#92400e', accent_soft: '#92400e15' },
    layout: { grid: 'centered', padding: 'luxurious', hierarchy: 'subtle' },
    motion: { philosophy: 'still', intensity: 0.2 },
  }),
  M('medical-professional', 'Medical Professional', 'corporate', {
    description: 'Clean medical blue + white. Trust-building, no nonsense.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 700, weight_body: 500, hook_size: 84, body_size: 36, tracking: '-0.02em' },
    palette: { background: '#f0f9ff', foreground: '#0c4a6e', muted: '#475569', accent: '#0284c7', accent_soft: '#0284c715' },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'standard' },
    motion: { philosophy: 'still', intensity: 0.2 },
  }),
  M('legal-authority', 'Legal Authority', 'corporate', {
    description: 'Navy + cream + serif. Authoritative, calm, law-firm energy.',
    typography: { primary: 'EB Garamond', display: 'EB Garamond', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 32, tracking: '-0.01em' },
    palette: { background: '#fefce8', foreground: '#1e3a8a', muted: '#475569', accent: '#7f1d1d', accent_soft: '#7f1d1d18' },
    layout: { grid: 'editorial', padding: 'luxurious', hierarchy: 'dramatic' },
    motion: { philosophy: 'still', intensity: 0.15 },
  }),
  M('motivational-alpha', 'Motivational Alpha', 'playful', {
    description: 'Black + red + screaming all-caps. High-T motivational content.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 700, hook_size: 120, body_size: 40, tracking: '-0.04em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#737373', accent: '#dc2626', accent_soft: '#dc262625' },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'extreme' },
    motion: { philosophy: 'kinetic', intensity: 0.9 },
    effects: { grain: 0.2 },
  }),
  M('streetwear-urban', 'Streetwear Urban', 'playful', {
    description: 'Concrete textures, spray-paint accents, oversized labels. Supreme/Off-White energy.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 700, hook_size: 110, body_size: 36, tracking: '0.04em' },
    palette: { background: '#1c1917', foreground: '#fef3c7', muted: '#a8a29e', accent: '#fb923c', accent_soft: '#fb923c20' },
    layout: { grid: 'asymmetric', padding: 'tight', hierarchy: 'dramatic' },
    motion: { philosophy: 'kinetic', intensity: 0.85 },
    effects: { grain: 0.35 },
  }),
  M('gaming-neon', 'Gaming Neon', 'playful', {
    description: 'RGB-overload palette. Twitch/esports aesthetic.',
    typography: { primary: 'JetBrains Mono', display: 'JetBrains Mono', weight_display: 800, weight_body: 600, hook_size: 92, body_size: 32, tracking: '0.04em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#a5b4fc', accent: '#a855f7', accent_soft: '#a855f720', gradient: ['#a855f7', '#22d3ee', '#22c55e'] },
    layout: { grid: 'centered', padding: 'tight', hierarchy: 'dramatic' },
    motion: { philosophy: 'kinetic', intensity: 0.9 },
    effects: { glow: 0.7 },
  }),
  M('sports-performance', 'Sports Performance', 'playful', {
    description: 'High-energy, gradient backgrounds, italic + condensed type. Nike-ad energy.',
    typography: { primary: 'Inter', display: 'Inter', weight_display: 900, weight_body: 700, hook_size: 110, body_size: 38, tracking: '-0.03em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#a3a3a3', accent: '#facc15', accent_soft: '#facc1520', gradient: ['#0a0a0a', '#facc15'] },
    layout: { grid: 'asymmetric', padding: 'standard', hierarchy: 'extreme' },
    motion: { philosophy: 'kinetic', intensity: 0.92 },
  }),
  M('documentary-storytelling', 'Documentary Storytelling', 'cinematic', {
    description: 'Cinematic 16:9 framing inside 1:1, deep blacks + warm spotlight. Vlogger-doc.',
    typography: { primary: 'EB Garamond', display: 'EB Garamond', weight_display: 700, weight_body: 400, hook_size: 84, body_size: 32, tracking: '-0.01em' },
    palette: { background: '#0a0a0a', foreground: '#fafafa', muted: '#a3a3a3', accent: '#f59e0b', accent_soft: '#f59e0b20' },
    layout: { grid: 'centered', padding: 'generous', hierarchy: 'subtle' },
    motion: { philosophy: 'cinematic', intensity: 0.55 },
    effects: { grain: 0.25, vignette: 0.4 },
    is_premium: true,
  }),
];

/* Sanity check at import — fail loudly in dev if a key collides. */
const _seen = new Set<string>();
for (const m of STYLE_MODES) {
  if (_seen.has(m.key)) throw new Error(`Duplicate style mode key: ${m.key}`);
  _seen.add(m.key);
}
