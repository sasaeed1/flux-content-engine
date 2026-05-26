import { PageHeader } from '@/components/flux/page-header';
import { BrandForm } from '@/components/brand/brand-form';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brand' };

export default async function BrandPage() {
  const [{ default: brand }, { themes }] = await Promise.all([
    api.brand(),
    api.themes(),
  ]);

  if (!brand) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Brand"
          subtitle="No brand profile found for this workspace."
        />
        <div className="rounded-2xl glass p-10 text-center text-sm text-muted-foreground">
          Create a brand profile via the API to get started — Flux will fall back to
          neutral defaults until you do.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title={
          <>
            Your <span className="gradient-text">brand</span>.
          </>
        }
        subtitle="The voice, tone, and visual feel Flux applies to every carousel it creates."
      />
      <BrandForm brand={brand} themes={themes} />
    </div>
  );
}
