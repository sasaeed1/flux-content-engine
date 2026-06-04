/**
 * Rate limiting / abuse prevention.
 *
 * In-memory fixed-window limiters (the app runs single-instance per container;
 * swap for Redis when you scale to multiple replicas). Three tiers:
 *
 *   - ipRateLimit         coarse per-IP DoS safety net (all requests)
 *   - tenantRateLimit     per-org cap on the general tenant API
 *   - generationRateLimit tight per-org cap on EXPENSIVE endpoints
 *                         (pipeline, reels, topic-gen, LLM intelligence calls)
 *
 * Keys are per-org (x-org-api-key) where a tenant is resolved, falling back to
 * client IP. Sets RateLimit-* + Retry-After headers; throws 429 on exceed.
 */
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env';
import { RateLimitError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

class FixedWindowLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {
    // Periodic cleanup so the map can't grow unbounded. Unref so it never
    // keeps the process alive.
    const timer = setInterval(() => this.sweep(), Math.max(windowMs, 30_000));
    (timer as { unref?: () => void }).unref?.();
  }

  hit(key: string): { allowed: boolean; remaining: number; limit: number; resetAt: number } {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, b);
    }
    b.count += 1;
    return {
      allowed: b.count <= this.max,
      remaining: Math.max(0, this.max - b.count),
      limit: this.max,
      resetAt: b.resetAt,
    };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}

function clientIp(req: Request): string {
  return (req.ip || req.socket?.remoteAddress || 'unknown').toString();
}

/** Per-org key when a tenant is resolved; else fall back to client IP. */
function tenantKey(req: Request): string {
  return req.tenant?.organizationId ?? clientIp(req);
}

function makeMiddleware(
  limiter: FixedWindowLimiter,
  keyFn: (req: Request) => string,
  label: string,
): RequestHandler {
  return (req, res, next) => {
    if (!env.RATE_LIMIT_ENABLED) {
      next();
      return;
    }
    const r = limiter.hit(`${label}:${keyFn(req)}`);
    res.setHeader('RateLimit-Limit', String(r.limit));
    res.setHeader('RateLimit-Remaining', String(r.remaining));
    res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((r.resetAt - Date.now()) / 1000))));
    if (!r.allowed) {
      const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      next(new RateLimitError(retryAfter));
      return;
    }
    next();
  };
}

const minute = 60_000;
const ipLimiter = new FixedWindowLimiter(minute, env.RATE_LIMIT_IP_PER_MIN);
const tenantLimiter = new FixedWindowLimiter(minute, env.RATE_LIMIT_TENANT_PER_MIN);
const generationLimiter = new FixedWindowLimiter(minute, env.RATE_LIMIT_GENERATION_PER_MIN);

/** Coarse per-IP limiter — mount globally before routes. */
export const ipRateLimit = makeMiddleware(ipLimiter, clientIp, 'ip');

/** Per-org limiter for the general tenant API. */
export const tenantRateLimit = makeMiddleware(tenantLimiter, tenantKey, 'tenant');

/** Tight per-org limiter for expensive (LLM / render) endpoints. */
export const generationRateLimit = makeMiddleware(generationLimiter, tenantKey, 'gen');
