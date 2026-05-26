/** Typed error hierarchy shared across the system. */

export interface AppErrorOptions {
  code?: string;
  retryable?: boolean;
  status?: number;
  cause?: unknown;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly context?: Record<string, unknown>;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? 'APP_ERROR';
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? 500;
    this.context = options.context;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class ConfigError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { ...options, code: 'CONFIG_ERROR', retryable: false, status: 500 });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'VALIDATION_ERROR',
      retryable: false,
      status: 400,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', options: AppErrorOptions = {}) {
    super(message, { ...options, code: 'UNAUTHORIZED', retryable: false, status: 401 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', options: AppErrorOptions = {}) {
    super(message, { ...options, code: 'NOT_FOUND', retryable: false, status: 404 });
  }
}

export class ExternalApiError extends AppError {
  readonly provider: string;

  constructor(provider: string, message: string, options: AppErrorOptions = {}) {
    super(`[${provider}] ${message}`, {
      ...options,
      code: options.code ?? 'EXTERNAL_API_ERROR',
      retryable: options.retryable ?? true,
      status: options.status ?? 502,
    });
    this.provider = provider;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, {
      ...options,
      code: 'DATABASE_ERROR',
      retryable: options.retryable ?? true,
      status: 500,
    });
  }
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorCode(err: unknown): string {
  if (err instanceof AppError) return err.code;
  if (err instanceof Error) return err.name;
  return 'UNKNOWN_ERROR';
}
