/** Registry mapping template `htmlTemplate` keys to renderer functions. */
import { renderSlide as renderMinimal, type RenderSlideArgs } from './minimal';
import { NotFoundError } from '../../../lib/errors';

type RendererFn = (args: RenderSlideArgs) => string;

const REGISTRY: Record<string, RendererFn> = {
  'minimal-carousel': renderMinimal,
  'minimal-quote': renderMinimal,
  'minimal-single': renderMinimal,
};

export function getHtmlRenderer(key: string): RendererFn {
  const fn = REGISTRY[key];
  if (!fn) {
    throw new NotFoundError(
      `Unknown HTML template "${key}". Registered: ${Object.keys(REGISTRY).join(', ')}`,
    );
  }
  return fn;
}

export type { RenderSlideArgs };
