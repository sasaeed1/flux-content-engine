/**
 * Image generation provider interface.
 *
 * The system supports several providers behind one abstraction. The default
 * (IMAGE_PROVIDER=none) skips AI image generation entirely — slides are
 * composed from the brand's background colour/gradient only. Providers
 * can be added or swapped without changing the pipeline.
 */
import type { ImageGenRequest, ImageGenResult, ImageProvider } from '../../types';

export interface ImageProviderImpl {
  readonly name: ImageProvider;
  generate(req: ImageGenRequest): Promise<ImageGenResult>;
}

export type { ImageGenRequest, ImageGenResult, ImageProvider };
