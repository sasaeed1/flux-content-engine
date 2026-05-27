/**
 * Logout — clears Flux session cookies and bounces to the landing page.
 */
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_API_KEY, COOKIE_ORG } from '@/lib/session';

export async function GET(req: NextRequest) {
  const out = NextResponse.redirect(new URL('/', req.url));
  out.cookies.delete(COOKIE_ORG);
  out.cookies.delete(COOKIE_API_KEY);
  return out;
}

export const POST = GET;
