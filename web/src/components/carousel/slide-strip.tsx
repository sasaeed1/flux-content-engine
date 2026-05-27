import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import type { SlideContent } from '@/lib/types';
import { SlideActions } from './slide-actions';

export function SlideStrip({
  slides,
  carouselId,
  editable = false,
}: {
  slides: SlideContent[];
  carouselId?: string;
  editable?: boolean;
}) {
  if (!slides?.length) {
    return (
      <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground pattern-dots">
        <Sparkles className="mx-auto mb-3 h-5 w-5 text-primary" />
        No slides rendered yet.
      </div>
    );
  }

  return (
    // Outer wrapper guarantees the strip never widens the page. On mobile the
    // inner row scrolls horizontally with snap-to-slide behavior so users can
    // swipe through carousel previews on a phone.
    <div className="w-full max-w-full overflow-x-auto overflow-y-hidden pb-4 scroll-hide snap-x snap-mandatory">
      <div className="flex gap-3 sm:gap-4">
        {slides.map((slide, i) => (
          <figure
            key={slide.index ?? i}
            className="group relative shrink-0 snap-start w-[78vw] max-w-[300px] sm:w-[260px] sm:max-w-none lg:w-[320px]"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
              {slide.imageUrl ? (
                <Image
                  src={slide.imageUrl}
                  alt={`Slide ${(slide.index ?? i) + 1}`}
                  fill
                  sizes="320px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Sparkles className="h-6 w-6" />
                </div>
              )}

              {/* Edit menu overlay — only on the carousel detail page */}
              {editable && carouselId && (
                <div className="absolute right-2 top-2 z-10">
                  <SlideActions
                    carouselId={carouselId}
                    slideIndex={slide.index ?? i}
                    slideRole={slide.role}
                  />
                </div>
              )}
            </div>
            <figcaption className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Slide {(slide.index ?? i) + 1}</span>
              <span>{slide.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
