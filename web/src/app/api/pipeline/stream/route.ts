/**
 * Server-Sent Events proxy for live pipeline streaming.
 *
 * The browser cannot speak to the engine directly (the org API key must stay
 * server-side per the architectural commitment). This route:
 *   1. Reads the SSO cookie to resolve the tenant's API key.
 *   2. Opens an SSE connection to the engine's /api/tenant/pipeline/run-stream.
 *   3. Pipes every chunk back to the browser as fast as it arrives.
 *
 * The Studio canvas hits POST /api/pipeline/stream with { topic, themeKey, ... }
 * and consumes the response as a ReadableStream via fetch().
 *
 * Runtime is forced to "nodejs" because we need duplex streaming (Edge runtime
 * on Next 15 doesn't reliably forward SSE keep-alives without buffering).
 */
import { cookies } from 'next/headers';
import { COOKIE_API_KEY } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENGINE_URL = process.env.CONTENT_ENGINE_URL ?? 'http://localhost:8090';
const FALLBACK_API_KEY = process.env.CONTENT_ENGINE_ORG_API_KEY ?? '';

async function resolveApiKey(): Promise<string> {
  try {
    const store = await cookies();
    const v = store.get(COOKIE_API_KEY)?.value;
    if (v) return v;
  } catch {
    /* not in request scope */
  }
  return FALLBACK_API_KEY;
}

export async function POST(req: Request): Promise<Response> {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({
        type: 'error',
        payload: { message: 'No Flux session — sign in first.' },
      })}\n\n`,
      { status: 401, headers: { 'content-type': 'text/event-stream' } },
    );
  }

  // Forward the JSON body verbatim — pipeline options shape is owned by the engine.
  const body = await req.text();

  // The engine call is unbounded — pipeline generation can take 30s+. We do
  // NOT set an AbortController timeout here; we rely on the client closing
  // the connection to trigger cleanup (the engine listens for req.close).
  let upstream: Response;
  try {
    upstream = await fetch(`${ENGINE_URL}/api/tenant/pipeline/run-stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'x-org-api-key': apiKey,
      },
      body,
      // No cache, no compression — SSE must be raw + immediate.
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `event: error\ndata: ${JSON.stringify({
        type: 'error',
        payload: { message: `Engine unreachable: ${message}` },
      })}\n\n`,
      { status: 502, headers: { 'content-type': 'text/event-stream' } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(
      `event: error\ndata: ${JSON.stringify({
        type: 'error',
        payload: { message: `Engine ${upstream.status}: ${text.slice(0, 300)}` },
      })}\n\n`,
      { status: upstream.status, headers: { 'content-type': 'text/event-stream' } },
    );
  }

  // Pipe through unchanged. We set our own headers to ensure no buffering in
  // any intermediate proxy (nginx, Cloudflare, Vercel).
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
