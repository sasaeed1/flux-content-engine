/**
 * Server-side fetch wrapper for the Flux content engine.
 *
 *   - The org API key is server-only — never reaches the browser.
 *   - All calls go through Next.js Server Components / Server Actions / Route Handlers.
 *   - `cache: 'no-store'` by default so the dashboard always shows fresh data;
 *     callers can pass `next.revalidate` to opt into ISR.
 */
import 'server-only';
import { cookies } from 'next/headers';
import type {
  BrandProfile,
  CarouselRow,
  InstagramAccount,
  Organization,
  OrgOverview,
  PipelineRun,
  Template,
  ThemePreset,
} from './types';

import { COOKIE_API_KEY } from './session';

const ENGINE_URL = process.env.CONTENT_ENGINE_URL ?? 'http://localhost:8090';
const FALLBACK_API_KEY = process.env.CONTENT_ENGINE_ORG_API_KEY ?? '';

interface FetchOpts extends Omit<RequestInit, 'body'> {
  json?: unknown;
}

/**
 * Resolve the org API key for the current request.
 *   1. Prefer the SSO-issued cookie (set by /auth/sso) — that scopes to the
 *      signed-in workspace.
 *   2. Fall back to the env-configured demo key so the default deployment
 *      still works for the seed workspace.
 */
async function resolveApiKey(): Promise<string> {
  try {
    // `cookies()` only works in request scope. If we're called outside one
    // (during build / static generation) this throws — we fall through.
    const store = await cookies();
    const v = store.get(COOKIE_API_KEY)?.value;
    if (v) return v;
  } catch {
    /* not in request scope */
  }
  return FALLBACK_API_KEY;
}

async function engineFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    throw new Error(
      'No Flux session — sign in or set CONTENT_ENGINE_ORG_API_KEY in web/.env.local',
    );
  }
  const headers = new Headers(opts.headers);
  headers.set('x-org-api-key', apiKey);
  if (opts.json !== undefined) headers.set('content-type', 'application/json');

  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : (opts as RequestInit).body,
    cache: opts.cache ?? 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Engine ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => engineFetch<{ organization: Organization | null }>('/api/tenant/me'),
  overview: () =>
    engineFetch<{ overview: OrgOverview | null }>('/api/tenant/overview'),
  themes: () => engineFetch<{ themes: ThemePreset[] }>('/api/tenant/themes'),
  templates: () => engineFetch<{ templates: Template[] }>('/api/tenant/templates'),

  brand: () =>
    engineFetch<{
      default: BrandProfile | null;
      all: Array<{ id: string; name: string; is_default: boolean }>;
    }>('/api/tenant/brand'),
  updateBrand: (id: string, patch: Record<string, unknown>) =>
    engineFetch<{ ok: true }>(`/api/tenant/brand/${id}`, {
      method: 'PATCH',
      json: patch,
    }),
  createBrand: (body: Record<string, unknown>) =>
    engineFetch<{ brand: { id: string } }>('/api/tenant/brand', {
      method: 'POST',
      json: body,
    }),

  nextTopic: () => engineFetch<{ topic: unknown }>('/api/tenant/topics/next'),
  addTopics: (topics: unknown[]) =>
    engineFetch<{ inserted: number; topics: unknown[] }>('/api/tenant/topics', {
      method: 'POST',
      json: { topics },
    }),
  generateTopics: (count: number, themeHint?: string) =>
    engineFetch<{ inserted: number; topics: unknown[] }>('/api/tenant/topics/generate', {
      method: 'POST',
      json: { count, themeHint },
    }),

  runPipeline: (body: {
    topicId?: string;
    brandProfileId?: string;
    templateKey?: string;
    postType?: string;
    approvalMode?: 'auto' | 'manual';
  }) => engineFetch<unknown>('/api/tenant/pipeline/run', { method: 'POST', json: body }),

  recentRuns: (limit = 8) =>
    engineFetch<{ runs: PipelineRun[] }>(`/api/tenant/pipeline/runs?limit=${limit}`),

  listCarousels: (limit = 50) =>
    engineFetch<{ carousels: CarouselRow[] }>(`/api/tenant/carousels?limit=${limit}`),
  getCarousel: (id: string) =>
    engineFetch<{ carousel: CarouselRow }>(`/api/tenant/carousels/${id}`),
  approveCarousel: (id: string, publishAt?: string) =>
    engineFetch<{ ok: true; publishQueueId: string }>(
      `/api/tenant/carousels/${id}/approve`,
      { method: 'POST', json: { publishAt } },
    ),

  // Instagram accounts
  listInstagramAccounts: () =>
    engineFetch<{ accounts: InstagramAccount[] }>('/api/tenant/instagram-accounts'),
  connectInstagram: (body: {
    igBusinessAccountId: string;
    accessToken: string;
    username?: string;
    makeDefault?: boolean;
  }) =>
    engineFetch<{ account: InstagramAccount }>('/api/tenant/instagram-accounts', {
      method: 'POST',
      json: body,
    }),
  disconnectInstagram: (id: string) =>
    engineFetch<{ ok: true }>(`/api/tenant/instagram-accounts/${id}`, {
      method: 'DELETE',
    }),

  // Caption edits
  setCaption: (id: string, caption: string) =>
    engineFetch<{ ok: true; caption: string }>(`/api/tenant/carousels/${id}/caption`, {
      method: 'POST',
      json: { caption },
    }),
  rewriteCaption: (
    id: string,
    style:
      | 'shorter'
      | 'longer'
      | 'professional'
      | 'casual'
      | 'aggressive'
      | 'stronger-cta'
      | 'rewrite',
  ) =>
    engineFetch<{ ok: true; caption: string }>(
      `/api/tenant/carousels/${id}/caption/rewrite`,
      { method: 'POST', json: { style } },
    ),

  // CTA edits
  setCta: (id: string, cta: string) =>
    engineFetch<{ ok: true; cta: string }>(`/api/tenant/carousels/${id}/cta`, {
      method: 'POST',
      json: { cta },
    }),
  rewriteCta: (id: string, variations = 3) =>
    engineFetch<{ ok: true; ctas: string[] }>(
      `/api/tenant/carousels/${id}/cta/rewrite`,
      { method: 'POST', json: { variations } },
    ),

  // Slide edits
  setSlide: (id: string, idx: number, data: Record<string, unknown>) =>
    engineFetch<{ ok: true; slides: unknown[] }>(
      `/api/tenant/carousels/${id}/slides/${idx}`,
      { method: 'POST', json: { data } },
    ),
  rewriteSlide: (
    id: string,
    idx: number,
    style: 'rewrite' | 'shorter' | 'denser' | 'rewrite-hook' | 'rewrite-cta',
  ) =>
    engineFetch<{ ok: true; slides: unknown[] }>(
      `/api/tenant/carousels/${id}/slides/${idx}/rewrite`,
      { method: 'POST', json: { style } },
    ),

  // Bulk approve
  bulkApprove: (carouselIds: string[], publishAt?: string) =>
    engineFetch<{
      ok: true;
      results: Array<{ id: string; ok: boolean; publishQueueId?: string; error?: string }>;
    }>('/api/tenant/carousels/bulk/approve', {
      method: 'POST',
      json: { carouselIds, publishAt },
    }),

  // Brand kit
  listBrandAssets: () =>
    engineFetch<{
      assets: Array<{
        id: string;
        type: string;
        provider: string;
        storage_path: string;
        public_url: string;
        bytes: number;
        created_at: string;
        metadata: Record<string, unknown>;
      }>;
    }>('/api/tenant/brand/assets'),
  uploadBrandAsset: (body: {
    filename: string;
    contentType: string;
    data: string;
    label?: string;
  }) =>
    engineFetch<{ asset: { id: string; public_url: string } }>(
      '/api/tenant/brand/assets',
      { method: 'POST', json: body },
    ),
  deleteBrandAsset: (id: string) =>
    engineFetch<{ ok: true }>(`/api/tenant/brand/assets/${id}`, { method: 'DELETE' }),
};
