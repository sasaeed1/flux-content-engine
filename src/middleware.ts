/**
 * Express middleware.
 *
 *   - requireTenant   : org-scoped auth via `x-org-api-key` header.
 *   - requireInternal : ops/worker auth via `x-api-key` (INTERNAL_API_KEY).
 *   - asyncHandler    : reject -> next(err) plumbing.
 *   - errorHandler    : terminal AppError-aware JSON response.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from './config/env';
import { AppError, UnauthorizedError, errorCode, toErrorMessage } from './lib/errors';
import { logger } from './lib/logger';
import { getOrgByApiKey } from './db/repositories';
import type { TenantContext } from './types';

/* ---------- request augmentation ---------- */

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantContext;
  }
}

/* ---------- helpers ---------- */

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
};

/* ---------- tenant auth ---------- */

export const requireTenant: RequestHandler = async (req, res, next) => {
  try {
    const apiKey =
      req.header('x-org-api-key') ??
      req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!apiKey) {
      throw new UnauthorizedError('Missing x-org-api-key header');
    }
    const org = await getOrgByApiKey(apiKey);
    if (!org) {
      throw new UnauthorizedError('Invalid x-org-api-key');
    }
    if (!org.active) {
      throw new UnauthorizedError('Organization is inactive');
    }
    req.tenant = {
      organizationId: org.id,
      apiKey: org.api_key,
      subscriptionTier: org.subscription_tier,
      aiProvider: org.ai_provider,
      aiProviderKey: org.ai_provider_key,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/* ---------- internal/ops auth ---------- */

export const requireInternal: RequestHandler = (req, res, next) => {
  const provided =
    req.header('x-api-key') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== env.INTERNAL_API_KEY) {
    next(new UnauthorizedError('Missing or invalid x-api-key (ops)'));
    return;
  }
  next();
};

/* ---------- error handler ---------- */

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err instanceof AppError ? err.status : 500;
  const message = toErrorMessage(err);
  logger.error(
    { path: req.path, method: req.method, status, error: message, orgId: req.tenant?.organizationId },
    'Request failed',
  );
  res.status(status).json({ error: errorCode(err), message });
}
