import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StudioCanvas } from '@/components/studio/studio-canvas';
import { StyleBrowser } from '@/components/studio/style-browser';
import { StudioWrapper } from '@/components/studio/studio-wrapper';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio · Flux' };

export default async function StudioPage() {
  // Parallel load — defensive: if any of these fails, the studio still
  // renders with sensible empties.
  const [stylesRes, insightsRes, carouselsRes] = await Promise.all([
    api.intelligence.styles().catch(() => ({ styles: [] })),
    api.intelligence.insights('studio').catch(() => ({ insights: [] })),
    api.listCarousels(6).catch(() => ({ carousels: [] })),
  ]);

  return (
    <div className="space-y-5">
      {/* Header — cinematic */}
      <header
        className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/30 p-6 sm:p-8"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 0% 0%, rgba(167,139,250,0.18), transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(34,211,238,0.10), transparent 50%)',
        }}
      >
        <div
          aria-hidden
          className="absolute -top-32 right-0 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'conic-gradient(from 90deg, #A78BFA, #22D3EE, #EC4899, #A78BFA)' }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Badge variant="accent">
              <Sparkles className="h-3 w-3" /> Studio
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              The <span className="gradient-text">creative cockpit.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Drop a topic. Pick a style from the 40-mode library. Flux
              routes the work across your providers and ships an on-brand
              carousel — ready for review.
            </p>
          </div>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:border-primary/40"
          >
            Review queue
          </Link>
        </div>
      </header>

      <StudioWrapper
        styles={stylesRes.styles}
        insights={insightsRes.insights}
        carousels={carouselsRes.carousels.map((c) => ({
          id: c.id,
          title: c.title,
          hook: c.hook,
          status: c.status,
          slide_count: c.slide_count,
          slides: c.slides,
          created_at: c.created_at,
        }))}
      />
    </div>
  );
}
