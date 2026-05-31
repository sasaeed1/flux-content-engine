import { Fingerprint, Palette } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/flux/page-header';
import { BrandForm } from '@/components/brand/brand-form';
import { ThemeCard } from '@/components/themes/theme-card';
import { StyleGallery } from '@/components/brand/style-gallery';
import { api } from '@/lib/api-client';
import type { StyleMode } from '@/components/flux/style-tile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brand Studio' };

const TABS = [
  { key: 'voice', label: 'Voice', icon: Fingerprint },
  { key: 'looks', label: 'Looks', icon: Palette },
] as const;

export default async function BrandStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === 'looks' ? 'looks' : 'voice';

  // Fetch in parallel; the Looks tab also needs the 40 style modes.
  const [brandRes, themesRes, stylesRes] = await Promise.allSettled([
    api.brand(),
    api.themes(),
    api.intelligence.styles(),
  ]);
  const brand = brandRes.status === 'fulfilled' ? brandRes.value.default : null;
  const themes = themesRes.status === 'fulfilled' ? themesRes.value.themes : [];
  const styles: StyleMode[] = stylesRes.status === 'fulfilled' ? stylesRes.value.styles : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Single source of truth"
        title={
          <>
            Brand <span className="gradient-text">studio</span>.
          </>
        }
        subtitle="Everything that defines how Flux renders you — voice and visual identity, in one place."
      />

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-edge-subtle">
        {TABS.map((t) => {
          const active = t.key === activeTab;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/brand?tab=${t.key}`}
              className={`press relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
                active ? 'text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-flux-cyan' : ''}`} />
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-flux-gradient" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Voice */}
      {activeTab === 'voice' && (
        <div className="space-y-2">
          <p className="text-sm text-fg-muted">
            {brand
              ? 'The voice, tone, and visual feel Flux applies to every carousel it creates.'
              : "We've pre-filled neutral defaults — tweak and save to make Flux sound like you."}
          </p>
          <BrandForm brand={brand} themes={themes} />
        </div>
      )}

      {/* Looks */}
      {activeTab === 'looks' && (
        <div className="space-y-8">
          {/* The 40 cinematic style modes — static grid + live motion preview */}
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Style modes</h2>
              <p className="text-sm text-fg-muted">
                40 cinematic looks — each a full personality (typography, palette, motion, effects).
                Browse the static grid, watch any one animate, then apply it when you{' '}
                <Link href="/forge" className="text-flux-cyan hover:underline">
                  forge
                </Link>
                .
              </p>
            </div>
            {styles.length === 0 ? (
              <div className="solid-card rounded-2xl p-10 text-center text-sm text-fg-muted">
                Style modes aren&apos;t loaded yet. They seed automatically on the engine — refresh
                in a moment.
              </div>
            ) : (
              <StyleGallery styles={styles} />
            )}
          </section>

          {/* Theme presets — the simpler color/type packs */}
          <section className="space-y-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Theme presets</h2>
              <p className="text-sm text-fg-muted">
                Quick color + type packs. Set one as your brand default — every carousel inherits it
                unless a style mode overrides.
              </p>
            </div>
            {themes.length === 0 ? (
              <div className="solid-card rounded-2xl p-8 text-center text-sm text-fg-muted">
                No theme presets yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((t) => (
                  <ThemeCard key={t.id} theme={t} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
