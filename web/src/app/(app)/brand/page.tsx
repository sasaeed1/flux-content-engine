import Link from 'next/link';
import { Fingerprint, Palette } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { BrandForm } from '@/components/brand/brand-form';
import { ThemeCard } from '@/components/themes/theme-card';
import { api } from '@/lib/api-client';

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

  const [{ default: brand }, { themes }] = await Promise.all([api.brand(), api.themes()]);

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
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            Pick the preset on your brand profile — every carousel inherits its colors, type, and
            visual tone. For the 40 cinematic style modes, open the{' '}
            <Link href="/forge" className="text-flux-cyan hover:underline">
              Forge
            </Link>
            .
          </p>
          {themes.length === 0 ? (
            <div className="solid-card rounded-2xl p-10 text-center text-sm text-fg-muted">
              No themes available yet. Seed your workspace with the system presets.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {themes.map((t) => (
                <ThemeCard key={t.id} theme={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
