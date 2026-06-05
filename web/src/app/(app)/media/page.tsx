import { PageHeader } from '@/components/flux/page-header';
import { MediaStudio } from '@/components/media/media-studio';
import { api } from '@/lib/api-client';
import type { MediaAsset } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Media Studio · Flux' };

export default async function MediaStudioPage() {
  let assets: MediaAsset[] = [];
  let error: string | null = null;
  try {
    ({ assets } = await api.listMedia());
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load media.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI media intelligence"
        title={
          <>
            Media <span className="gradient-text">studio</span>.
          </>
        }
        subtitle="Upload raw photos — Flux analyzes quality, ranks the best, gives a creative-director verdict, and enhances them into production-ready assets. Phase 1: images (video next)."
      />

      {error && (
        <div className="rounded-lg border border-state-danger/40 bg-state-danger-bg px-4 py-3 text-sm text-state-danger">
          {error}
        </div>
      )}

      <MediaStudio assets={assets} />
    </div>
  );
}
