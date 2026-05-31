'use client';

/**
 * BriefBar — the personal daily brief that opens Home.
 *
 * Time-aware greeting + a one-sentence AI synthesis of the day's state, a
 * commanding "Open the Forge" CTA, and the live workspace-mode chip. Replaces
 * the static "Welcome back to Flux." The ambient aurora + thinking dot make it
 * feel like the engine is greeting you, not a header.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Wand2 } from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { useEngineActivity } from '@/lib/use-engine-activity';

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Late night';
}

export function BriefBar({
  synthesis,
  workspaceName,
}: {
  /** AI synthesis of the day, computed server-side from overview. */
  synthesis: string;
  workspaceName: string;
}) {
  const [hello, setHello] = useState('Welcome back');
  const { isThinking, currentLabel } = useEngineActivity();

  useEffect(() => {
    setHello(greeting(new Date()));
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-edge-subtle bg-surface-0 px-6 py-7 sm:px-8 sm:py-8">
      <AuroraBackground intensity="subtle" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-label text-fg-dim">
            <span
              className={
                isThinking
                  ? 'h-1.5 w-1.5 rounded-full bg-flux-violet shadow-[0_0_10px_2px_rgba(139,92,246,0.7)]'
                  : 'h-1.5 w-1.5 rounded-full bg-flux-cyan/80 shadow-[0_0_8px_1px_rgba(34,211,238,0.5)] animate-breathe'
              }
            />
            {isThinking ? currentLabel ?? 'Flux is working' : 'Flux is observing'}
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {hello}. <span className="text-fg-muted">Here&apos;s your brief.</span>
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-fg-muted">{synthesis}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/forge"
            className="press group inline-flex h-12 items-center gap-2 rounded-sm bg-flux-gradient bg-[length:200%_200%] px-6 text-sm font-bold text-flux-ink glow-cta transition-[background-position] duration-500 hover:bg-[position:100%_50%]"
          >
            <Wand2 className="h-4 w-4" />
            Open the Forge
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
