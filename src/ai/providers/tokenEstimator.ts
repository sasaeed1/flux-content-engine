/**
 * Token estimation for providers that don't return usage metadata.
 *
 * GPT-style models average ~4 chars per token for English. This is wrong for
 * code, languages with non-Latin scripts, and JSON — but as a quota signal
 * (we only need order-of-magnitude accuracy to enforce budget caps) it's
 * good enough. Providers that DO return usage (OpenAI, OpenRouter, Gemini)
 * override this.
 */
export function estimateTokens(parts: Array<string | undefined | null>): number {
  let chars = 0;
  for (const p of parts) {
    if (typeof p === 'string') chars += p.length;
  }
  return Math.max(1, Math.ceil(chars / 4));
}
