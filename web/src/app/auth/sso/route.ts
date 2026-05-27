/**
 * Flux SSO landing — receives a signed token (issued by WappFlow), exchanges
 * it with the engine for an org session, then writes httpOnly cookies and
 * redirects to /dashboard.
 *
 *   GET /auth/sso?token=<JWT>&redirect=/dashboard
 */
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_ORG, COOKIE_API_KEY } from '@/lib/session';

const ENGINE_URL = process.env.CONTENT_ENGINE_URL ?? 'http://localhost:8090';

/**
 * Build an absolute URL using the proxied Host/Proto headers — Next.js
 * inside Docker sees `localhost:3000` as its host and would otherwise
 * redirect users to the internal port. Nginx is configured with
 *   proxy_set_header Host $host;
 *   proxy_set_header X-Forwarded-Proto $scheme;
 * so we trust those.
 */
function publicUrl(req: NextRequest, path: string): URL {
  const forwardedHost =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const forwardedProto =
    req.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }
  return new URL(path, req.url);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const redirectPath = url.searchParams.get('redirect') ?? '/dashboard';

  if (!token) {
    return NextResponse.redirect(publicUrl(req, '/login?error=missing_token'));
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/sso/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[sso] exchange failed', res.status, text.slice(0, 200));
      return NextResponse.redirect(
        publicUrl(req, `/login?error=sso_failed&code=${res.status}`),
      );
    }
    const data = (await res.json()) as {
      organization: { id: string; api_key: string; name: string };
      user: { email?: string | null; name?: string | null };
    };

    // Redirect → set cookies on the same response.
    const safeRedirect = redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const out = NextResponse.redirect(publicUrl(req, safeRedirect));

    // httpOnly cookies — never visible to client JS.
    // 30-day session; rotates on each SSO so an upgrade in WappFlow propagates.
    const thirtyDays = 60 * 60 * 24 * 30;
    out.cookies.set(COOKIE_ORG, data.organization.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: thirtyDays,
    });
    out.cookies.set(COOKIE_API_KEY, data.organization.api_key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: thirtyDays,
    });
    return out;
  } catch (err) {
    console.error('[sso] error', err);
    return NextResponse.redirect(publicUrl(req, '/login?error=sso_error'));
  }
}
