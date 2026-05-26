/** Exponential-backoff retry with jitter + Retry-After awareness. */
import axios from 'axios';
import { AppError } from './errors';
import { logger } from './logger';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof AppError) return err.retryable;
  if (axios.isAxiosError(err)) {
    if (!err.response) return true; // network / DNS / timeout
    const s = err.response.status;
    return s === 408 || s === 409 || s === 425 || s === 429 || s >= 500;
  }
  return false;
}

function retryAfterMs(err: unknown): number | null {
  if (!axios.isAxiosError(err) || !err.response) return null;
  const header = err.response.headers?.['retry-after'];
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(header));
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  label?: string;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 4;
  const base = options.baseDelayMs ?? 1500;
  const max = options.maxDelayMs ?? 45_000;
  const factor = options.factor ?? 2;
  const label = options.label ?? 'task';

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isRetryable(err)) throw err;

      const explicit = retryAfterMs(err);
      const backoff = Math.min(max, base * factor ** (attempt - 1));
      const jitter = Math.random() * backoff * 0.3;
      const delay = explicit ?? Math.round(backoff + jitter);

      logger.warn(
        { label, attempt, retries, delayMs: delay, error: (err as Error)?.message },
        'Retrying after transient failure',
      );
      await sleep(delay);
    }
  }
}
