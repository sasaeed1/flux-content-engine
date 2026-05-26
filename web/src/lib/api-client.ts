/**
 * Server-side fetch wrapper for the Flux content engine.
 *
 *   - The org API key is server-only — never reaches the browser.
 *   - All calls go through Next.js Server Components / Server Actions / Route Handlers.
 *   - `cache: 'no-store'` by default so the dashboard always shows fresh data;
 *     callers can pass `next.revalidate` to opt into ISR.
 */
import 'server-only';
import type {
  BrandProfile,
  CarouselRow,
  Organization,
  OrgOverview,
  PipelineRun,
  Template,
  ThemePreset,
} from './types';

const ENGINE_URL = process.env.CONTENT_ENGINE_URL ?? 'http://localhost:8090';
const ORG_API_KEY = process.env.CONTENT_ENGINE_ORG_API_KEY ?? '';

interface FetchOpts extends Omit<RequestInit, 'body'> {
  json?: unknown;
}

async function engineFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  if (!ORG_API_KEY) {
    throw new Error('CONTENT_ENGINE_ORG_API_KEY is not set in web/.env.local');
  }
  const headers = new Headers(opts.headers);
  headers.set('x-org-api-key', ORG_API_KEY);
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
};
