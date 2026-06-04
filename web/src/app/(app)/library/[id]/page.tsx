import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SlideStrip } from '@/components/carousel/slide-strip';
import { ApprovalBar } from '@/components/carousel/approval-bar';
import { CaptionEditor } from '@/components/carousel/caption-editor';
import { CtaEditor } from '@/components/carousel/cta-editor';
import { RestyleSwitcher } from '@/components/carousel/restyle-switcher';
import { ReelStudio } from '@/components/motion/reel-studio';
import { api } from '@/lib/api-client';
import { fmtRelative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CarouselDetailPage({
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

  const editable = !['approved', 'published', 'publishing', 'scheduled'].includes(
    carousel.status,
  );

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

  let reels: Awaited<ReturnType<typeof api.reels.list>>['reels'] = [];
  try {
    ({ reels } = await api.reels.list(id));
  } catch {
    /* generated_reels table may not exist until the migration is applied */
  }

  return (
    <div className="min-w-0 space-y-7">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-fg-muted">
        <Link href="/library" className="press transition hover:text-fg">
          Library
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-fg-dim" />
        <span className="truncate text-fg">{carousel.title ?? 'Untitled carousel'}</span>
      </nav>

      {/* header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-label text-fg-dim">Carousel · {fmtRelative(carousel.created_at)}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="gradient-text break-words">
              {carousel.title ?? 'Untitled carousel'}
            </span>
          </h1>
          {carousel.hook && <p className="max-w-2xl text-sm text-fg-muted">{carousel.hook}</p>}
        </div>
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
      </header>

      <SlideStrip slides={carousel.slides ?? []} carouselId={carousel.id} editable={editable} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="space-y-3">
            <h2 className="text-label text-fg-muted">Caption</h2>
            {editable ? (
              <CaptionEditor carouselId={carousel.id} initial={carousel.caption} />
            ) : (
              <div className="solid-card whitespace-pre-wrap rounded-lg p-5 text-sm leading-relaxed">
                {carousel.caption ?? (
                  <span className="text-fg-muted">No caption written yet.</span>
                )}
              </div>
            )}
          </div>

          {carousel.cta && (
            <div className="space-y-3">
              <h3 className="text-label text-fg-muted">Call to action</h3>
              {editable ? (
                <CtaEditor carouselId={carousel.id} initial={carousel.cta} />
              ) : (
                <div className="solid-card rounded-lg p-5 text-sm">{carousel.cta}</div>
              )}
            </div>
          )}

          {carousel.hashtags?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-label text-fg-muted">Hashtags</h3>
              <div className="solid-card flex flex-wrap gap-1.5 rounded-lg p-4">
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

          <ReelStudio carouselId={carousel.id} initialReels={reels} />

          <div className="solid-card rounded-lg p-5 text-xs text-fg-muted">
            {[
              ['Slides', String(carousel.slide_count)],
              ['Created', fmtRelative(carousel.created_at)],
              ['Updated', fmtRelative(carousel.updated_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1">
                <span>{k}</span>
                <span className="text-fg">{v}</span>
              </div>
            ))}
            <div className="flex justify-between py-1">
              <span>Carousel ID</span>
              <code className="font-mono text-[10px] text-fg">{carousel.id.slice(0, 8)}…</code>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
