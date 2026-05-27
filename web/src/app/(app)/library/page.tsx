import Link from 'next/link';
import { Images, Plus } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { LibraryGrid } from '@/components/library/library-grid';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Library' };

export default async function LibraryPage() {
  let carousels: Awaited<ReturnType<typeof api.listCarousels>>['carousels'] = [];
  let error: string | null = null;

  try {
    ({ carousels } = await api.listCarousels(60));
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load carousels.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your carousels"
        title={
          <>
            The <span className="gradient-text">library</span>.
          </>
        }
        subtitle="Every carousel Flux has produced. Edit, approve, or bulk-publish."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard">
              <Plus className="h-3.5 w-3.5" /> Generate
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {carousels.length === 0 && !error ? (
        <div className="rounded-2xl glass p-16 text-center pattern-dots">
          <Images className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-base font-medium">No carousels yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hit{' '}
            <span className="rounded bg-muted/40 px-1.5 py-0.5 text-foreground">
              Run pipeline
            </span>{' '}
            on the dashboard to generate your first one.
          </p>
        </div>
      ) : (
        <LibraryGrid carousels={carousels} />
      )}
    </div>
  );
}
