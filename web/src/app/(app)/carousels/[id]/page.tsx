import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SlideStrip } from '@/components/carousel/slide-strip';
import { ApprovalBar } from '@/components/carousel/approval-bar';
import { CaptionEditor } from '@/components/carousel/caption-editor';
import { CtaEditor } from '@/components/carousel/cta-editor';
import { RestyleSwitcher } from '@/components/carousel/restyle-switcher';
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

  // Once a carousel has been approved/scheduled/published, edits are locked.
  const editable = !['approved', 'published', 'publishing', 'scheduled'].includes(
    carousel.status,
  );

  // Post-audit #4 — load styles in parallel for the restyle switcher.
  // Failure is non-blocking — the page still renders without the switcher.
  let styleOptions: Array<{ key: string; name: string; category: string | null }> = [];
  try {
    const { styles } = await api.intelligence.styles();
    styleOptions = styles.map((s) => ({ key: s.key, name: s.name, category: s.category }));
  } catch {
    /* leave empty */
  }
  const currentStyleModeKey =
    ((carousel as unknown as { metadata?: { style_mode_key?: string } | null })
      .metadata?.style_mode_key as string | undefined) ?? null;

  return (
    <div className="space-y-8 min-w-0">
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/library">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to library
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Carousel · ${fmtRelative(carousel.created_at)}`}
        title={
          <span className="gradient-text break-words">
            {carousel.title ?? 'Untitled carousel'}
          </span>
        }
        subtitle={carousel.hook}
        actions={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            {editable && styleOptions.length > 0 && (
              <RestyleSwitcher
                carouselId={carousel.id}
                currentStyleModeKey={currentStyleModeKey}
                styles={styleOptions}
              />
            )}
            <Badge variant="accent" className="self-start">
              {carousel.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        }
      />

      <SlideStrip slides={carousel.slides ?? []} carouselId={carousel.id} editable={editable} />

      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        <section className="space-y-6 lg:col-span-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Caption
            </h2>
            {editable ? (
              <CaptionEditor carouselId={carousel.id} initial={carousel.caption} />
            ) : (
              <div className="whitespace-pre-wrap rounded-2xl glass p-5 text-sm leading-relaxed">
                {carousel.caption ?? (
                  <span className="text-muted-foreground">No caption written yet.</span>
                )}
              </div>
            )}
          </div>

          {carousel.cta && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Call to action
              </h3>
              {editable ? (
                <CtaEditor carouselId={carousel.id} initial={carousel.cta} />
              ) : (
                <div className="rounded-2xl glass p-5 text-sm">{carousel.cta}</div>
              )}
            </div>
          )}

          {carousel.hashtags?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Hashtags
              </h3>
              <div className="flex flex-wrap gap-1.5 rounded-2xl glass p-4">
                {carousel.hashtags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
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
