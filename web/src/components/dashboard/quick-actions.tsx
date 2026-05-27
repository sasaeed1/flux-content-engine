'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generateTopicsAction,
  runPipelineAction,
} from '@/app/(app)/dashboard/actions';

type Result =
  | { kind: 'success'; message: string; href: string; cta: string }
  | { kind: 'error'; message: string }
  | null;

export function QuickActions() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result>(null);

  const generate = () =>
    start(async () => {
      setResult(null);
      try {
        const res = await generateTopicsAction(3);
        setResult({
          kind: 'success',
          message: `Added ${res.inserted} fresh topic${res.inserted === 1 ? '' : 's'} to your queue.`,
          href: '/library?tab=topics',
          cta: 'See topics',
        });
      } catch (err) {
        setResult({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to generate.',
        });
      }
    });

  const runNow = () =>
    start(async () => {
      setResult(null);
      try {
        const res = await runPipelineAction({ approvalMode: 'manual' });
        const carouselId = (res as { carouselId?: string }).carouselId;
        // Refresh recent runs in the background
        router.refresh();
        setResult({
          kind: 'success',
          message: 'Carousel produced — review and approve it in the library.',
          href: carouselId ? `/carousels/${carouselId}` : '/library',
          cta: carouselId ? 'Review carousel' : 'Open library',
        });
      } catch (err) {
        setResult({
          kind: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to start pipeline.',
        });
      }
    });

  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Quick actions
        </h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        One-click ways to fill your queue or push the next carousel.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={generate} disabled={pending} variant="primary">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generate 3 topics
        </Button>
        <Button onClick={runNow} disabled={pending} variant="outline">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Run pipeline
        </Button>
      </div>

      {result?.kind === 'success' && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="flex-1">{result.message}</span>
          <Link
            href={result.href}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
          >
            {result.cta} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {result?.kind === 'error' && (
        <p className="mt-3 text-xs text-red-300">{result.message}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 pt-4 text-xs text-muted-foreground">
        <Link
          href="/library"
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          Open library <ExternalLink className="h-3 w-3" />
        </Link>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          Settings <ExternalLink className="h-3 w-3" />
        </Link>
        <Link
          href="/help"
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          Help <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
