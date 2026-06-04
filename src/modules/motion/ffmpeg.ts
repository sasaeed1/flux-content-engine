/**
 * ffmpeg wrapper — resolves the bundled ffmpeg-static binary (or an env
 * override) and runs filtergraphs. Backend-only; no GPU; zero API cost.
 */
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import ffmpegStatic from 'ffmpeg-static';
import { env } from '../../config/env';
import { AppError, ConfigError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';

const execFileAsync = promisify(execFile);
const log = childLogger({ module: 'motion:ffmpeg' });

let _path: string | null = null;

/** Resolve the ffmpeg binary: FFMPEG_PATH override > ffmpeg-static bundle. */
export function resolveFfmpegPath(): string {
  if (_path) return _path;

  if (env.FFMPEG_PATH) {
    if (!fs.existsSync(env.FFMPEG_PATH)) {
      throw new ConfigError(`FFMPEG_PATH points to a non-existent file: ${env.FFMPEG_PATH}`);
    }
    _path = env.FFMPEG_PATH;
    return _path;
  }

  const bundled = ffmpegStatic as unknown as string | null;
  if (bundled && fs.existsSync(bundled)) {
    _path = bundled;
    return _path;
  }

  throw new ConfigError(
    'No ffmpeg binary available — ffmpeg-static did not ship one for this ' +
      'platform. Set FFMPEG_PATH to a system ffmpeg in your .env.',
  );
}

export interface RunFfmpegOptions {
  args: string[];
  /** Expected output duration (seconds) — reserved for progress reporting. */
  totalDurationSec?: number;
  /** Hard timeout in ms. Defaults to MOTION_RENDER_TIMEOUT_SEC. */
  timeoutMs?: number;
  label?: string;
}

/**
 * Run ffmpeg with the given args. Resolves on exit code 0; rejects with an
 * AppError carrying the tail of stderr otherwise. `-hide_banner -nostdin -y`
 * are always prepended.
 */
export function runFfmpeg(opts: RunFfmpegOptions): Promise<void> {
  const bin = resolveFfmpegPath();
  const label = opts.label ?? 'ffmpeg';
  const timeoutMs = opts.timeoutMs ?? env.MOTION_RENDER_TIMEOUT_SEC * 1000;

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ['-hide_banner', '-nostdin', '-y', ...opts.args], {
      windowsHide: true,
    });

    let stderrTail = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(
        new AppError(`ffmpeg timed out after ${timeoutMs}ms (${label})`, {
          code: 'FFMPEG_TIMEOUT',
        }),
      );
    }, timeoutMs);

    proc.stderr.on('data', (chunk: Buffer) => {
      // ffmpeg is very chatty on stderr — keep only the tail for diagnostics.
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(
        new AppError(`Failed to start ffmpeg (${label}): ${err.message}`, {
          code: 'FFMPEG_SPAWN',
        }),
      );
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      log.error({ label, code, stderrTail: stderrTail.slice(-800) }, 'ffmpeg failed');
      reject(
        new AppError(`ffmpeg exited ${code} (${label})`, {
          code: 'FFMPEG_FAILED',
          context: { stderrTail: stderrTail.slice(-1200) },
        }),
      );
    });
  });
}

/** Probe the binary — path + version line. Used by the ops/health route. */
export async function probeFfmpeg(): Promise<{ path: string; version: string }> {
  const bin = resolveFfmpegPath();
  const { stdout } = await execFileAsync(bin, ['-version'], { timeout: 10_000 });
  const version = stdout.split(/\r?\n/)[0]?.trim() ?? 'unknown';
  return { path: bin, version };
}
