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

  // ----- LLM provider -----
  AI_PROVIDER: z.enum(['groq', 'openai', 'ollama']).default('groq'),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:7b'),

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
