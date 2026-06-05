import Link from 'next/link';
import { LayoutGrid, Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { LibraryGrid } from '@/components/library/library-grid';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import type { CarouselRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Library' };

const FILTERS: Array<{ key: string; label: string; match: (s: string) => boolean }> = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'ready', label: 'Ready', match: (s) => ['ready', 'ready_for_review', 'pending_approval'].includes(s) },
  { key: 'drafts', label: 'Drafts', match: (s) => ['draft', 'pending'].includes(s) },
  { key: 'scheduled', label: 'Scheduled', match: (s) => ['approved', 'scheduled', 'publishing'].includes(s) },
  { key: 'published', label: 'Published', match: (s) => s === 'published' },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];

  let carousels: CarouselRow[] = [];
  let error: string | null = null;
  try {
    ({ carousels } = await api.listCarousels(60));
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load carousels.';
  }

  const filtered = carousels.filter((c) => activeFilter.match(c.status));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your body of work"
        title={
          <>
            The <span className="gradient-text">library</span>.
          </>
        }
        subtitle="Every carousel Flux has forged. Filter, edit, restyle, or bulk-publish."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/forge">
              <Wand2 className="h-3.5 w-3.5" /> Open the Forge
            </Link>
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = carousels.filter((c) => f.match(c.status)).length;
          const active = f.key === activeFilter.key;
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/library' : `/library?status=${f.key}`}
              className={`press inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition ${
                active
                  ? 'border-flux-cyan/50 bg-surface-2 text-fg ring-1 ring-flux-cyan/25'
                  : 'border-edge-subtle bg-surface-1 text-fg-muted hover:border-edge-strong hover:text-fg'
              }`}
            >
              {f.label}
              <span className={`font-mono text-[11px] ${active ? 'text-flux-cyan' : 'text-fg-dim'}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-state-danger/40 bg-state-danger-bg px-4 py-3 text-sm text-state-danger">
          {error}
        </div>
      )}

      {filtered.length === 0 && !error ? (
        <div className="solid-card rounded-2xl p-16 text-center pattern-dots">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-flux-violet/15">
            <LayoutGrid className="h-6 w-6 text-flux-violet-bright" />
          </div>
          <p className="mt-3 text-base font-semibold">
            {activeFilter.key === 'all' ? 'No carousels yet' : `Nothing ${activeFilter.label.toLowerCase()}`}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {activeFilter.key === 'all' ? (
              <>
                Head to the{' '}
                <Link href="/forge" className="text-flux-cyan hover:underline">
                  Forge
                </Link>{' '}
                and create your first one.
              </>
            ) : (
              'Try another filter, or forge something new.'
            )}
          </p>
        </div>
      ) : (
        <LibraryGrid carousels={filtered} />
      )}
    </div>
  );
}
