import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { ForgeWrapper } from '@/components/forge/forge-wrapper';
import { api } from '@/lib/api-client';
import type { StyleMode } from '@/components/flux/style-tile';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forge' };

const EVERGREEN_SPARKS = [
  'A contrarian take on what everyone gets wrong',
  '5 mistakes quietly costing you growth',
  'The one habit that compounds over a year',
  'Why most content dies in the first 3 seconds',
];

export default async function ForgePage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string }>;
}) {
  const { seed } = await searchParams;

  const [stylesRes, brand] = await Promise.all([
    api.intelligence.styles().catch(() => ({ styles: [] as StyleMode[] })),
    api.brand().catch(() => null),
  ]);

  const niche = brand?.default?.niche ?? null;
  const sparks = EVERGREEN_SPARKS.map((s) =>
    niche ? `${s}${s.endsWith('growth') ? ` in ${niche}` : ''}` : s,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Badge variant="thinking">
            <Sparkles className="h-3 w-3" /> Forge
          </Badge>
          <span className="hidden text-sm text-fg-dim sm:inline">
            Your creative engine — type, and Flux co-creates live.
          </span>
        </div>
      </div>

      <ForgeWrapper styles={stylesRes.styles} initialSeed={seed ?? ''} sparks={sparks} />
    </div>
  );
}
