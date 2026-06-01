/**
 * Provider plane — shared types.
 *
 * Each provider implements `LLMProvider`. The router (src/ai/router.ts) picks
 * a provider per call based on the requested *tier* (fast / balanced /
 * reasoning / utility), the provider's health, and remaining quota for the
 * current key.
 */

export type ProviderId =
  | 'groq'
  | 'openrouter'
  | 'gemini'
  | 'huggingface'
  | 'cloudflare'
  | 'together'
  | 'openai'
  | 'ollama';

export type ModelTier = 'fast' | 'balanced' | 'reasoning' | 'utility';

export interface LLMCallArgs {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  /** Force JSON mode if the provider supports it. */
  jsonMode?: boolean;
}

export interface LLMCallResult {
  text: string;
  provider: ProviderId;
  model: string;
  /** Which API key index in the rotation we used (for quota tracking). */
  keyIndex: number;
  /** Latency in ms (end-to-end including retries). */
  latencyMs: number;
  /** Rough token count (input + output) for cost tracking. */
  approxTokens?: number;
}

export interface LLMProvider {
  id: ProviderId;
  /** Higher = preferred at equal availability. Free-tier providers get higher. */
  priority: number;
  /** True if the provider has any API keys configured. */
  isConfigured(): boolean;
  /** How many API keys are in the rotation pool. */
  keyCount(): number;
  /** Resolve the model name for a tier. Falls back across tiers if absent. */
  modelFor(tier: ModelTier): string;
  /** Make the call. Throws ExternalApiError on failure. */
  complete(args: LLMCallArgs, tier: ModelTier, keyIndex: number): Promise<LLMCallResult>;
  /** Daily quota cap per key — used by quotaTracker. */
  dailyQuotaPerKey(): number;
  /**
   * Sprint A — cost classification.
   * `isPaid: true` providers are skipped by the router unless ALLOW_PAID_FALLBACK
   * is on AND the entire free pool is exhausted, OR the caller explicitly
   * preferred this provider.
   */
  isPaid: boolean;
  /**
   * Relative cost weight. 0 = free, higher = pricier. Used for cost-tier
   * classification and surfacing on the provider status endpoint.
   * Per-million tokens, in cents (approx). Free providers: 0.
   */
  costPer1MTokens: number;
}
