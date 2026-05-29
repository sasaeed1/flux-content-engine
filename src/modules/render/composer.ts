/**
 * Composer — turns a CarouselContent (per-slide data) into rendered PNG
 * assets stored in the content-renders bucket.
 *
 * Image AI integration: when IMAGE_PROVIDER != 'none', an AI background
 * image can be generated for the hook slide before the HTML render. For
 * the foundation pass, the composer relies on the brand background + the
 * template's typographic design. The image hook is left in place as a
 * documented extension point (`generateImage`).
 */
import { uploadBuffer, storagePaths } from '../../lib/storage';
import { env } from '../../config/env';
import { DEFAULT_SLIDE_DIMS } from '../../config/constants';
import { childLogger } from '../../lib/logger';
import { renderHtmlToPng } from './htmlRenderer';
import { getHtmlRenderer } from './templates';
import type { StyleModeOverlay } from './templates/minimal';
import type {
  BrandProfile,
  RenderedSlide,
  SlideContent,
  Template,
} from '../../types';

const log = childLogger({ module: 'composer' });

export interface ComposeInput {
  orgId: string;
  runId: string;
  brand: BrandProfile;
  template: Template;
  slides: SlideContent[];
  /** Optional style mode overlay — overrides brand theme visuals. */
  styleMode?: StyleModeOverlay | null;
}

export async function composeSlides(input: ComposeInput): Promise<RenderedSlide[]> {
  const renderer = getHtmlRenderer(input.template.definition.htmlTemplate);
  const dims = DEFAULT_SLIDE_DIMS;
  const total = input.slides.length;
  const results: RenderedSlide[] = [];

  for (const slide of input.slides) {
    const html = renderer({
      htmlTemplate: input.template.definition.htmlTemplate,
      layout: slide.layout,
      data: slide.data,
      brand: input.brand,
      width: dims.width,
      height: dims.height,
      slideIndex: slide.index,
      totalSlides: total,
      styleMode: input.styleMode ?? null,
    });

    const png = await renderHtmlToPng(html, dims);
    const path = storagePaths.render(input.orgId, input.runId, slide.index);
    const { publicUrl } = await uploadBuffer({
      bucket: env.SUPABASE_RENDER_BUCKET,
      path,
      body: png,
      contentType: 'image/png',
    });

    results.push({
      slideIndex: slide.index,
      storagePath: path,
      publicUrl,
      width: dims.width,
      height: dims.height,
      bytes: png.length,
    });
  }

  log.info(
    { runId: input.runId, slides: results.length, totalBytes: results.reduce((n, r) => n + r.bytes, 0) },
    'Slides composed',
  );
  return results;
}
