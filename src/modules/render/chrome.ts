/**
 * Chrome / Chromium executable detection for puppeteer-core.
 *
 *   1. CHROME_EXECUTABLE_PATH env var wins.
 *   2. Auto-detect on the current platform.
 *   3. Throw a clear ConfigError if none found.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config/env';
import { ConfigError } from '../../lib/errors';

function candidatePaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA;
  const home = os.homedir();

  switch (process.platform) {
    case 'win32':
      return [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ...(localAppData
          ? [path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')]
          : []),
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
    case 'darwin':
      return [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      ];
    case 'linux':
      return [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
      ];
    default:
      return [];
  }
}

export function resolveChromePath(): string {
  if (env.CHROME_EXECUTABLE_PATH) {
    if (!fs.existsSync(env.CHROME_EXECUTABLE_PATH)) {
      throw new ConfigError(
        `CHROME_EXECUTABLE_PATH points to a non-existent file: ${env.CHROME_EXECUTABLE_PATH}`,
      );
    }
    return env.CHROME_EXECUTABLE_PATH;
  }

  const candidates = candidatePaths();
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new ConfigError(
    [
      'Could not auto-detect a Chrome/Chromium binary for the renderer.',
      'Set CHROME_EXECUTABLE_PATH in your .env, or install Chrome.',
      'Looked in: ' + candidates.join(' | '),
    ].join('\n'),
  );
}
