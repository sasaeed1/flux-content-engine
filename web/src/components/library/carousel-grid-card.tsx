import type { ComponentProps } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Images, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtRelative, truncate } from '@/lib/format';
import type { CarouselRow } from '@/lib/types';

const STATUS_VARIANT: Record<string, ComponentProps<typeof Badge>['variant']> = {
  draft: 'outline',
  ready: 'accent',
  ready_for_review: 'info',
  approved: 'info',
  scheduled: 'info',
  publishing: 'warning',
  published: 'success',
  failed: 'danger',
};

export function CarouselGridCard({ row }: { row: CarouselRow }) {
  const cover = row.slides?.[0];
  const coverUrl = cover?.imageUrl;
  const slideCount = row.slide_count || row.slides?.length || 0;

  return (
    <Link
      href={`/carousels/${row.id}`}
      className="group relative block overflow-hidden rounded-2xl glass glass-hover"
    >
      <div className="relative aspect-square w-full bg-secondary/40">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={row.title ?? row.hook ?? 'Carousel cover'}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center pattern-dots">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="absolute left-3 top-3">
          <Badge variant={STATUS_VARIANT[row.status] ?? 'outline'}>
            {row.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        {slideCount > 0 && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
            <Images className="h-3 w-3" /> {slideCount}
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
            {truncate(row.hook || row.title || 'Untitled', 100)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
        <span>{fmtRelative(row.updated_at || row.created_at)}</span>
        {row.hashtags?.length > 0 && (
          <span className="truncate">
            {row.hashtags.slice(0, 2).join(' ')}
            {row.hashtags.length > 2 && ` +${row.hashtags.length - 2}`}
          </span>
        )}
      </div>
    </Link>
  );
}
