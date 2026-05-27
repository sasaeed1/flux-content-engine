/**
 * Logout — clears Flux session cookies and bounces to the landing page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_API_KEY, COOKIE_ORG } from '@/lib/session';

export async function GET(req: NextRequest) {
  const forwardedHost =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const forwardedProto =
    req.headers.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.url;
  const out = NextResponse.redirect(new URL('/', base));
  out.cookies.delete(COOKIE_ORG);
  out.cookies.delete(COOKIE_API_KEY);
  return out;
}

export const POST = GET;
