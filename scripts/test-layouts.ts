#!/usr/bin/env tsx
/**
 * Render-test the new slide layouts (timeline/comparison/infographic/editorial/
 * poster) to PNGs locally — no Supabase. Writes ../flux-layout-<name>.png.
 *
 *   npx tsx scripts/test-layouts.ts
 */
import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const STYLE = {
  typography: {
    display: 'Space Grotesk',
    primary: 'Inter',
    hook_size: 100,
    body_size: 40,
    weight_display: 800,
    tracking: '-0.02em',
  },
  palette: {
    background: '#080814',
    foreground: '#F2F4FA',
    muted: '#8a93a6',
    accent: '#22D3EE',
    accent_soft: 'rgba(34,211,238,0.16)',
    gradient: ['#1E1B4B', '#0E7490'],
  },
  effects: { glow: 0.4, grain: 0.08, vignette: 0.35 },
};

const SAMPLES: { layout: string; data: Record<string, unknown> }[] = [
  {
    layout: 'timeline',
    data: {
      title: 'How automation compounds',
      items: [
        'Week 1 — Audit the busywork',
        'Week 2 — Automate one workflow',
        'Week 3 — Measure hours saved',
        'Week 4 — Double down on winners',
      ],
    },
  },
  {
    layout: 'comparison',
    data: {
      title: 'Manual vs Automated',
      leftTitle: 'Manual',
      leftItems: ['3 hrs/day', 'Error-prone', "Doesn't scale"],
      rightTitle: 'Automated',
      rightItems: ['12 min/day', 'Consistent', 'Scales free'],
    },
  },
  {
    layout: 'infographic',
    data: {
      title: 'The numbers',
      items: ['~70% — tasks automatable', '3x — faster turnaround', '$0 — extra cost', '24/7 — always on'],
    },
  },
  {
    layout: 'editorial',
    data: {
      kicker: 'THE SHIFT',
      title: "Your team size isn't the limit",
      body: "The bottleneck isn't headcount — it's how much of your day is still manual.",
    },
  },
  {
    layout: 'poster',
    data: { subtitle: 'AI Automation', title: 'Do less. Ship more.', tagline: 'A 4-step system for solo founders.' },
  },
];

async function main() {
  process.env.INTERNAL_API_KEY ||= 'local-layout-test';
  process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-key-1234567890';

  const { renderSlide } = await import('../src/modules/render/templates/minimal');
  const { renderHtmlToPng } = await import('../src/modules/render/htmlRenderer');

  const brand = {
    id: 't',
    organizationId: 't',
    name: 'Demo',
    niche: 'AI automation',
    businessType: null,
    tone: 'confident',
    postStyle: 'educational',
    ctaStyle: 'follow',
    logoUrl: null,
    voiceKeywords: [],
    voiceAvoid: [],
    theme: {
      presetKey: null,
      colors: {
        background: '#0A0A12',
        foreground: '#F5F6FA',
        muted: '#9aa3b2',
        accent: '#A78BFA',
        accentSoft: 'rgba(167,139,250,0.16)',
      },
      typography: {
        fontPrimary: 'Inter',
        fontDisplay: 'Space Grotesk',
        weightDisplay: 800,
        weightBody: 500,
        sizeHook: 96,
        sizeBody: 40,
      },
      visualTone: null,
      effects: {},
    },
  };

  const dims = { width: 1080, height: 1350 };
  for (let i = 0; i < SAMPLES.length; i++) {
    const sample = SAMPLES[i];
    const html = renderSlide({
      htmlTemplate: 'minimal-carousel',
      layout: sample.layout,
      data: sample.data as never,
      brand: brand as never,
      width: dims.width,
      height: dims.height,
      slideIndex: i,
      totalSlides: SAMPLES.length,
      styleMode: STYLE as never,
    });
    const png = await renderHtmlToPng(html, dims);
    const out = path.resolve(process.cwd(), '..', `flux-layout-${sample.layout}.png`);
    await writeFile(out, png);
    // eslint-disable-next-line no-console
    console.log(`${sample.layout}: ${(png.length / 1024).toFixed(1)} KB -> ${out}`);
  }
  const { shutdownRenderer } = await import('../src/modules/render/htmlRenderer');
  await shutdownRenderer();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
