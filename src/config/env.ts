/**
 * Environment configuration — loaded + validated once at boot.
 * Invalid config => fast exit with a clear error.
 */
import 'dotenv/config';
import { z } from 'zod';

const asBool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : /^(1|true|yes|on)$/i.test(v)));

const asNum = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .pipe(z.number().finite());

const schema = z.object({
  // ----- server -----
  NODE_ENV: z.string().default('development'),
  PORT: asNum(8090),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('UTC'),
  INTERNAL_API_KEY: z.string().min(8, 'INTERNAL_API_KEY must be at least 8 chars'),

  // ----- supabase -----
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_IMAGE_BUCKET: z.string().default('content-images'),
  SUPABASE_RENDER_BUCKET: z.string().default('content-renders'),
  SUPABASE_LOGO_BUCKET: z.string().default('brand-logos'),

  // ----- LLM provider — primary (legacy single-provider path) -----
  AI_PROVIDER: z.enum(['groq', 'openai', 'ollama']).default('groq'),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:7b'),

  // ----- multi-provider router (Phase 1) -----
  // Each entry is a comma-separated list of API keys for round-robin rotation
  // across multiple free-tier accounts on the same provider. Empty = disabled.
  GROQ_API_KEYS: z.string().default(''),         // comma-separated, supplement to GROQ_API_KEY
  OPENROUTER_API_KEYS: z.string().default(''),
  OPENROUTER_MODEL_FAST: z.string().default('meta-llama/llama-3.1-8b-instruct:free'),
  OPENROUTER_MODEL_REASONING: z.string().default('meta-llama/llama-3.1-70b-instruct:free'),
  GEMINI_API_KEYS: z.string().default(''),
  GEMINI_MODEL_FAST: z.string().default('gemini-2.0-flash-exp'),
  GEMINI_MODEL_REASONING: z.string().default('gemini-2.0-flash-thinking-exp-1219'),
  HUGGINGFACE_API_KEYS: z.string().default(''),
  HUGGINGFACE_MODEL_FAST: z.string().default('meta-llama/Llama-3.2-3B-Instruct'),
  HUGGINGFACE_MODEL_REASONING: z.string().default('meta-llama/Llama-3.1-70B-Instruct'),
  CLOUDFLARE_AI_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_AI_API_KEYS: z.string().default(''),
  CLOUDFLARE_AI_MODEL_FAST: z.string().default('@cf/meta/llama-3.1-8b-instruct'),
  CLOUDFLARE_AI_MODEL_REASONING: z.string().default('@cf/meta/llama-3.1-70b-instruct'),
  TOGETHER_API_KEYS: z.string().default(''),
  TOGETHER_MODEL_FAST: z.string().default('meta-llama/Llama-3.2-3B-Instruct-Turbo'),
  TOGETHER_MODEL_REASONING: z.string().default('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'),

  // ----- response cache (Phase 1) -----
  ENABLE_RESPONSE_CACHE: asBool(true),
  CACHE_TTL_SECONDS: asNum(60 * 60 * 24 * 14), // 14d default
  // Soft caps for sliding-window quota tracking (per-key, per-day).
  // Conservative defaults below each provider's published free tier.
  QUOTA_DAILY_GROQ: asNum(14000),
  QUOTA_DAILY_OPENROUTER: asNum(180),
  QUOTA_DAILY_GEMINI: asNum(1400),
  QUOTA_DAILY_HUGGINGFACE: asNum(900),
  QUOTA_DAILY_CLOUDFLARE: asNum(9000),
  QUOTA_DAILY_TOGETHER: asNum(60),

  // ----- image provider -----
  IMAGE_PROVIDER: z.enum(['none', 'openai', 'comfyui', 'fal']).default('none'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  COMFYUI_BASE_URL: z.string().default('http://localhost:8188'),
  FAL_API_KEY: z.string().default(''),

  // ----- renderer -----
  CHROME_EXECUTABLE_PATH: z.string().default(''),

  // ----- scheduler -----
  ENABLE_INTERNAL_SCHEDULER: asBool(true),
  ENABLE_DAILY_PIPELINE_CRON: asBool(false),
  DAILY_PIPELINE_CRON: z.string().default('0 9 * * *'),
  PUBLISH_QUEUE_CRON: z.string().default('*/10 * * * *'),
  RETRY_CRON: z.string().default('*/15 * * * *'),
  ANALYTICS_CRON: z.string().default('0 */6 * * *'),

  // ----- pipeline tuning -----
  DEFAULT_CAROUSEL_SLIDES: asNum(7),
  MAX_CAROUSEL_SLIDES: asNum(10),
  PUBLISH_POLL_TIMEOUT_SEC: asNum(300),
  IMAGE_GEN_TIMEOUT_SEC: asNum(120),

  // ----- instagram -----
  IG_GRAPH_API_VERSION: z.string().default('v21.0'),

  // ----- wappflow integration -----
  WAPPFLOW_WEBHOOK_URL: z.string().default(''),
  WAPPFLOW_WEBHOOK_SECRET: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('\n[config] Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  // eslint-disable-next-line no-console
  console.error('\nFix your .env file (see .env.example) and restart.\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
export const isProduction = env.NODE_ENV === 'production';

/**
 * Assert a feature key is present. Throws a descriptive error at the
 * point of use rather than failing boot for optional features.
 */
export function requireEnv(key: keyof Env, hint?: string): string {
  const value = env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `Missing required configuration "${String(key)}"${hint ? ` — ${hint}` : ''}. ` +
        `Set it in your .env file.`,
    );
  }
  return String(value);
}
