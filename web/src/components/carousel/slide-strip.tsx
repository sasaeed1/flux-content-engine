import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import type { SlideContent } from '@/lib/types';

export function SlideStrip({ slides }: { slides: SlideContent[] }) {
  if (!slides?.length) {
    return (
      <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground pattern-dots">
        <Sparkles className="mx-auto mb-3 h-5 w-5 text-primary" />
        No slides rendered yet.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scroll-hide snap-x snap-mandatory">
      {slides.map((slide, i) => (
        <figure
          key={slide.index ?? i}
          className="relative shrink-0 snap-start"
          style={{ width: 'min(72vw, 360px)' }}
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
            {slide.imageUrl ? (
              <Image
                src={slide.imageUrl}
                alt={`Slide ${(slide.index ?? i) + 1}`}
                fill
                sizes="360px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Sparkles className="h-6 w-6" />
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
  );
}
