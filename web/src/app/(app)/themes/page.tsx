import { PageHeader } from '@/components/flux/page-header';
import { ThemeCard } from '@/components/themes/theme-card';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Themes' };

export default async function ThemesPage() {
  const { themes } = await api.themes();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Design system"
        title={
          <>
            <span className="gradient-text">Themes</span> Flux can wear.
          </>
        }
        subtitle="Pick the preset on your brand profile — every carousel inherits its colors, type, and visual tone."
      />

      {themes.length === 0 ? (
        <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground">
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
  );
}
