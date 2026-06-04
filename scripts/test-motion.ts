#!/usr/bin/env tsx
/**
 * Standalone motion-engine smoke test — proves PNG slides -> MP4 reel with
 * zero Supabase / LLM dependency.
 *
 *   npx tsx scripts/test-motion.ts
 *
 * Generates a few sample 4:5 slides with Sharp, runs the composer, and writes
 * a real .mp4 to the Sami folder so you can open and watch it.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SLIDES: { text: string; from: string; to: string }[] = [
  { text: 'Stop scrolling.', from: '#1E1B4B', to: '#0E7490' },
  { text: 'Cinematic reels.', from: '#4C1D95', to: '#0891B2' },
  { text: 'Zero API cost.', from: '#312E81', to: '#9333EA' },
  { text: 'Follow for more.', from: '#0E7490', to: '#1E1B4B' },
];

async function makeSlide(s: { text: string; from: string; to: string }, file: string) {
  const svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${s.from}"/>
        <stop offset="1" stop-color="${s.to}"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#g)"/>
    <circle cx="860" cy="240" r="140" fill="#ffffff" fill-opacity="0.10"/>
    <text x="90" y="720" font-family="Arial, sans-serif" font-size="104"
      font-weight="bold" fill="#ffffff">${s.text}</text>
    <rect x="92" y="780" width="220" height="10" rx="5" fill="#22D3EE"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}

async function main() {
  // Motion render touches neither Supabase nor any LLM — stub the required
  // env so config validation passes for this standalone test.
  process.env.INTERNAL_API_KEY ||= 'local-motion-test-key';
  process.env.SUPABASE_URL ||= 'https://placeholder.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder-service-role-key';

  const { composeReel } = await import('../src/modules/motion/composer');
  const { presetForStyleMotion } = await import('../src/modules/motion/presets');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'flux-motion-'));
  const slides: { index: number; source: string }[] = [];
  for (let i = 0; i < SLIDES.length; i++) {
    const file = path.join(tmp, `slide${i}.png`);
    await makeSlide(SLIDES[i], file);
    slides.push({ index: i, source: file });
  }

  const preset = presetForStyleMotion('cinematic', 0.6);
  const outPath = path.resolve(process.cwd(), '..', 'flux-reel-demo.mp4');

  // eslint-disable-next-line no-console
  console.log('Rendering reel with preset:', preset.key, '->', outPath);
  const result = await composeReel({ slides, preset, aspect: 'reel', outPath });
  // eslint-disable-next-line no-console
  console.log('DONE:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
