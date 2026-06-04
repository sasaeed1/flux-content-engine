/**
 * HTML -> PNG renderer (puppeteer-core + Sharp).
 *
 *   - One headless browser is reused across renders.
 *   - Each render gets its own page (deterministic, isolated).
 *   - Fonts are awaited (document.fonts.ready) before screenshotting.
 *   - Sharp re-encodes the PNG for size + consistent metadata.
 */
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';
import { PNG_QUALITY } from '../../config/constants';
import { childLogger } from '../../lib/logger';
import { AppError, toErrorMessage } from '../../lib/errors';
import { resolveChromePath } from './chrome';

const log = childLogger({ module: 'renderer' });

let _browser: Browser | null = null;
let _launching: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  if (_launching) return _launching;
  _launching = puppeteer
    .launch({
      executablePath: resolveChromePath(),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=medium',
        '--hide-scrollbars',
      ],
    })
    .then((b) => {
      _browser = b;
      _launching = null;
      log.info('Headless browser launched');
      return b;
    })
    .catch((err) => {
      _launching = null;
      throw new AppError(`Failed to launch headless browser: ${toErrorMessage(err)}`, {
        code: 'RENDERER_LAUNCH_FAILED',
      });
    });
  return _launching;
}

/** Shared headless browser getter — reused by the kinetic frame renderer. */
export const getBrowser = launch;

export async function shutdownRenderer(): Promise<void> {
  if (_browser) {
    try {
      await _browser.close();
    } catch {
      /* ignore */
    }
    _browser = null;
    log.info('Headless browser closed');
  }
}

export interface RenderHtmlOptions {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  waitForFonts?: boolean;
  timeoutMs?: number;
}

/** Render an HTML document to a PNG buffer at the given dimensions. */
export async function renderHtmlToPng(
  html: string,
  opts: RenderHtmlOptions,
): Promise<Buffer> {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: opts.width,
      height: opts.height,
      deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    });
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: opts.timeoutMs ?? 60_000,
    });
    if (opts.waitForFonts !== false) {
      // Wait for @font-face loads to settle. Use the string form of evaluate
      // so we don't have to pull DOM types into the Node-side tsconfig.
      await page.evaluate('document.fonts.ready');
    }
    const raw = await page.screenshot({ type: 'png', fullPage: false, omitBackground: false });
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);

    return await sharp(buf)
      .png({ quality: PNG_QUALITY, compressionLevel: 9 })
      .toBuffer();
  } finally {
    await page.close().catch(() => {});
  }
}
