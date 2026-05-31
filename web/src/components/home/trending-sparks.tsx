'use client';

/**
 * TrendingSparks — "what should I create next?", answered concretely.
 *
 * Tappable idea chips (seeded from the org's queued topics + niche-aware
 * evergreen prompts) that launch the Forge with that seed pre-filled. The
 * chips shimmer faintly so the row feels discovered, not listed.
 */
import Link from 'next/link';
import { Flame, Sparkles } from 'lucide-react';

export function TrendingSparks({ seeds }: { seeds: string[] }) {
  if (!seeds.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-flux-gold" />
        <h2 className="font-display text-base font-semibold tracking-tight">Trending for you</h2>
        <span className="text-[11px] text-fg-dim">tap to forge</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {seeds.map((seed, i) => (
          <Link
            key={`${seed}-${i}`}
            href={`/forge?seed=${encodeURIComponent(seed)}`}
            className="press group inline-flex max-w-full animate-fade-up items-center gap-2 rounded-pill border border-edge-strong bg-surface-1 py-2 pl-3 pr-4 text-[13px] text-fg-muted transition-all hover:border-flux-violet/45 hover:bg-surface-2 hover:text-fg"
            style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-flux-violet-bright opacity-70 transition group-hover:opacity-100" />
            <span className="truncate">{seed}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
