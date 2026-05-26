import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SlideStrip } from '@/components/carousel/slide-strip';
import { ApprovalBar } from '@/components/carousel/approval-bar';
import { api } from '@/lib/api-client';
import { fmtRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CarouselPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let carousel: Awaited<ReturnType<typeof api.getCarousel>>['carousel'] | null = null;
  try {
    ({ carousel } = await api.getCarousel(id));
  } catch {
    notFound();
  }
  if (!carousel) notFound();

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/library">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to library
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Carousel · ${fmtRelative(carousel.created_at)}`}
        title={
          <span className="gradient-text">
            {carousel.title ?? 'Untitled carousel'}
          </span>
        }
        subtitle={carousel.hook}
        actions={
          <Badge variant="accent" className="self-start">
            {carousel.status.replace(/_/g, ' ')}
          </Badge>
        }
      />

      <SlideStrip slides={carousel.slides ?? []} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Caption
          </h2>
          <div className="whitespace-pre-wrap rounded-2xl glass p-5 text-sm leading-relaxed">
            {carousel.caption ?? <span className="text-muted-foreground">No caption written yet.</span>}
          </div>

          {carousel.hashtags?.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Hashtags
              </h3>
              <div className="flex flex-wrap gap-1.5 rounded-2xl glass p-4">
                {carousel.hashtags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </>
          )}

          {carousel.cta && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Call to action
              </h3>
              <div className="rounded-2xl glass p-5 text-sm">{carousel.cta}</div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <ApprovalBar carouselId={carousel.id} status={carousel.status} />

          <div className="rounded-2xl glass p-5 text-xs text-muted-foreground">
            <div className="flex justify-between py-1">
              <span>Slides</span>
              <span className="text-foreground">{carousel.slide_count}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Created</span>
              <span className="text-foreground">{fmtRelative(carousel.created_at)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Updated</span>
              <span className="text-foreground">{fmtRelative(carousel.updated_at)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Carousel ID</span>
              <code className="font-mono text-[10px] text-foreground">
                {carousel.id.slice(0, 8)}…
              </code>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
