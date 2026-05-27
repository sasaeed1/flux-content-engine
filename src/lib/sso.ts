/**
 * Lightweight HMAC-SHA256 token signer/verifier used for cross-app SSO.
 *
 *   - Format: `<b64url(headerJson)>.<b64url(payloadJson)>.<b64url(sig)>`
 *   - Algorithm fixed at HS256. The shared secret is `FLUX_SSO_SECRET`
 *     and must match between WappFlow (issuer) and Flux engine (audience).
 *   - Tokens are short-lived (≤ 60s by convention) and single-use is
 *     advisory — Flux trusts an unexpired signature.
 *
 * We intentionally avoid pulling in `jsonwebtoken` for the engine — keeping
 * the dep surface small. The token shape is JWT-compatible so existing
 * tooling can debug it.
 */
import crypto from 'node:crypto';
import { AppError } from './errors';

export interface FluxSsoPayload {
  iss: 'wappflow' | string;
  aud: 'flux';
  /** WappFlow workspace UUID — the org we're bridging. */
  wf_workspace_id: string;
  /** WappFlow user UUID — the human who clicked the button. */
  wf_user_id: string;
  email?: string;
  name?: string;
  /** WappFlow plan tier — Flux gates features off this. */
  plan?: string;
  iat: number;
  exp: number;
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function getSecret(): string {
  const s = process.env.FLUX_SSO_SECRET;
  if (!s || s.length < 16) {
    throw new AppError(
      'FLUX_SSO_SECRET is not set (or is too short). Set a 32+ char secret shared with WappFlow.',
      { status: 500, code: 'SSO_MISCONFIGURED' },
    );
  }
  return s;
}

export function signSsoToken(payload: Omit<FluxSsoPayload, 'iat' | 'exp'>, ttlSec = 60): string {
  const now = Math.floor(Date.now() / 1000);
  const full: FluxSsoPayload = { ...payload, iat: now, exp: now + ttlSec } as FluxSsoPayload;
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlEncode(JSON.stringify(full));
  const sig = b64urlEncode(
    crypto.createHmac('sha256', getSecret()).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${sig}`;
}

export function verifySsoToken(token: string): FluxSsoPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AppError('SSO: bad token shape', { status: 401, code: 'SSO_BAD_TOKEN' });
  const [h, b, s] = parts;
  const expectedSig = b64urlEncode(
    crypto.createHmac('sha256', getSecret()).update(`${h}.${b}`).digest(),
  );
  // Constant-time compare
  const a = Buffer.from(s);
  const e = Buffer.from(expectedSig);
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) {
    throw new AppError('SSO: bad signature', { status: 401, code: 'SSO_BAD_SIGNATURE' });
  }
  let payload: FluxSsoPayload;
  try {
    payload = JSON.parse(b64urlDecode(b).toString('utf8')) as FluxSsoPayload;
  } catch {
    throw new AppError('SSO: bad payload', { status: 401, code: 'SSO_BAD_PAYLOAD' });
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new AppError('SSO: token expired', { status: 401, code: 'SSO_EXPIRED' });
  }
  if (payload.aud !== 'flux') {
    throw new AppError('SSO: wrong audience', { status: 401, code: 'SSO_BAD_AUDIENCE' });
  }
  if (!payload.wf_workspace_id) {
    throw new AppError('SSO: missing workspace_id', { status: 401, code: 'SSO_MISSING_CLAIM' });
  }
  return payload;
}
