/**
 * Performance memory → LLM prompt block.
 *
 * Phase 3D wired performance weights into the *archetype picker* but NOT into
 * the LLM prompts themselves. The audit flagged this as a partial honouring of
 * the "memory read on every generation" commitment.
 *
 * This module fixes it: any prompt-building route can call
 * `renderPerformanceMemoryBlock(orgId)` to get a short, model-friendly block
 * describing what's been working for this brand. The block is appended to the
 * system prompt for /hooks/generate and /topics/score, so the model has actual
 * engagement signal instead of generic taste.
 *
 * The block is deliberately short (≤8 lines) — long memory dumps confuse small
 * fast-tier models and burn tokens.
 */
import { loadPerformanceWeights } from './performanceRollup';

export interface MemoryBlockOptions {
  /** How many top items per dimension to surface. Default 3. */
  topPerDim?: number;
  /** Minimum sample size — anything below this is filtered out. Default 2. */
  minSamples?: number;
  /** Provide an already-loaded weights map to skip the DB query. */
  preloaded?: Awaited<ReturnType<typeof loadPerformanceWeights>>;
}

/**
 * Returns an empty string when the org has no rollup data yet — callers
 * should treat absence as "no memory to inject, fall back to brand voice".
 */
export async function renderPerformanceMemoryBlock(
  orgId: string,
  options: MemoryBlockOptions = {},
): Promise<string> {
  const top = Math.max(1, Math.min(8, options.topPerDim ?? 3));
  const minSamples = Math.max(1, options.minSamples ?? 2);

  const weights =
    options.preloaded ??
    (await loadPerformanceWeights(orgId, { minSamples }).catch(() => null));
  if (!weights || weights.sampleSize === 0) return '';

  const rank = (m: Map<string, { sample: number; avgEngagement: number }>): string[] =>
    [...m.entries()]
      .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement)
      .slice(0, top)
      .map(([k, v]) => `${k} (${(v.avgEngagement * 100).toFixed(1)}% eng, n=${v.sample})`);

  const lines: string[] = [];
  lines.push(
    `WHAT'S BEEN WORKING (engagement memory for this brand, sample size ${weights.sampleSize}):`,
  );

  const hookLine = rank(weights.byHook);
  if (hookLine.length > 0) {
    lines.push(`  hook archetypes: ${hookLine.join(', ')}`);
  }

  const styleLine = rank(weights.byStyle);
  if (styleLine.length > 0) {
    lines.push(`  style modes: ${styleLine.join(', ')}`);
  }

  const ctaLine = rank(weights.byCta);
  if (ctaLine.length > 0) {
    lines.push(`  CTAs: ${ctaLine.join(', ')}`);
  }

  // Action guidance — without this the model often ignores numerical data.
  lines.push(
    "  Lean toward these patterns but don't blindly mimic. Diversity > sameness — pick adjacent angles, not duplicates.",
  );

  // If only one line of context exists beyond the header, the block is too
  // thin to be useful — better to inject nothing than confusing partial data.
  if (lines.length < 3) return '';

  return lines.join('\n');
}
