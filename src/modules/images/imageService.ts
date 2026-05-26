/**
 * Image Service — multi-provider AI image generation.
 *
 *   - openai     : DALL·E / gpt-image-1 via the OpenAI Images API.
 *   - comfyui    : self-hosted ComfyUI (stubbed; implement when wiring SD/Flux).
 *   - fal        : Fal.ai hosted Flux (stubbed; cheap pay-as-you-go).
 *   - none       : no AI image — composer falls back to template backgrounds.
 *
 * For low-cost / free-tier dev, default to `none`: slides still look great
 * thanks to the typographic templates + brand theme.
 */
import axios from 'axios';
import { env, requireEnv } from '../../config/env';
import { ExternalApiError } from '../../lib/errors';
import { describeAxiosError } from '../../lib/http';
import { withRetry } from '../../lib/retry';
import { childLogger } from '../../lib/logger';
import type { ImageGenRequest, ImageGenResult, ImageProvider } from '../../types';

const log = childLogger({ module: 'image-service' });

/* ---------- OpenAI Images (gpt-image-1) ---------- */

const OPENAI_SIZES = ['1024x1024', '1024x1536', '1536x1024'] as const;
function closestOpenAISize(w: number, h: number): (typeof OPENAI_SIZES)[number] {
  if (h > w) return '1024x1536';
  if (w > h) return '1536x1024';
  return '1024x1024';
}

async function generateOpenAI(req: ImageGenRequest): Promise<ImageGenResult> {
  const apiKey = requireEnv('OPENAI_API_KEY', 'required when IMAGE_PROVIDER=openai');
  const size = closestOpenAISize(req.width, req.height);

  const data = await withRetry(
    async () => {
      const res = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: env.OPENAI_IMAGE_MODEL,
          prompt: req.prompt,
          size,
          n: 1,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: env.IMAGE_GEN_TIMEOUT_SEC * 1000,
        },
      );
      return res.data as { data?: Array<{ b64_json?: string; url?: string }> };
    },
    { label: 'openai-images' },
  ).catch((err) => {
    throw new ExternalApiError('openai-images', describeAxiosError(err), { retryable: false });
  });

  const item = data.data?.[0];
  if (!item) throw new ExternalApiError('openai-images', 'no image returned');

  let buffer: Buffer;
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    const dl = await axios.get<ArrayBuffer>(item.url, { responseType: 'arraybuffer' });
    buffer = Buffer.from(dl.data);
  } else {
    throw new ExternalApiError('openai-images', 'no image payload (b64 or url)');
  }

  // size is approximate; we'll cover->resize in the renderer / Sharp
  const [w, h] = size.split('x').map(Number) as [number, number];
  return { buffer, width: w, height: h, provider: 'openai' };
}

/* ---------- ComfyUI (stubbed) ---------- */

async function generateComfyUI(_req: ImageGenRequest): Promise<ImageGenResult> {
  // Future: workflow JSON -> POST {COMFYUI_BASE_URL}/prompt, then poll history.
  throw new ExternalApiError(
    'comfyui',
    'ComfyUI provider is not implemented yet — set IMAGE_PROVIDER=none or openai for now.',
    { retryable: false },
  );
}

/* ---------- Fal.ai (stubbed) ---------- */

async function generateFal(_req: ImageGenRequest): Promise<ImageGenResult> {
  // Future: POST https://fal.run/fal-ai/flux/dev (or schnell) with prompt + image_size.
  throw new ExternalApiError(
    'fal',
    'Fal provider is not implemented yet — set IMAGE_PROVIDER=none or openai for now.',
    { retryable: false },
  );
}

/* ---------- Public API ---------- */

export function imageProvider(): ImageProvider {
  return env.IMAGE_PROVIDER;
}

/**
 * Returns `null` when IMAGE_PROVIDER=none (intentional — pipeline composes
 * slides from template backgrounds only).
 */
export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult | null> {
  const provider = env.IMAGE_PROVIDER;
  if (provider === 'none') return null;

  log.info({ provider, w: req.width, h: req.height }, 'Generating AI image');
  switch (provider) {
    case 'openai':
      return generateOpenAI(req);
    case 'comfyui':
      return generateComfyUI(req);
    case 'fal':
      return generateFal(req);
  }
}
