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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title={
          <>
            Your <span className="gradient-text">brand</span>.
          </>
        }
        subtitle={
          brand
            ? 'The voice, tone, and visual feel Flux applies to every carousel it creates.'
            : "Set up the voice, tone, and visual feel Flux should use. We've pre-filled neutral defaults — tweak and save."
        }
      />
      <BrandForm brand={brand} themes={themes} />
    </div>
  );
}
