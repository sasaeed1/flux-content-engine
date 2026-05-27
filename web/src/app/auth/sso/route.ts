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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const redirectPath = url.searchParams.get('redirect') ?? '/dashboard';

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url));
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
        new URL(`/login?error=sso_failed&code=${res.status}`, req.url),
      );
    }
    const data = (await res.json()) as {
      organization: { id: string; api_key: string; name: string };
      user: { email?: string | null; name?: string | null };
    };

    // Redirect → set cookies on the same response.
    const safeRedirect = redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const out = NextResponse.redirect(new URL(safeRedirect, req.url));

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
    return NextResponse.redirect(new URL('/login?error=sso_error', req.url));
  }
}
