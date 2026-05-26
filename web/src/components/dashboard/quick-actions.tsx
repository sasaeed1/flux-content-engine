'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generateTopicsAction,
  runPipelineAction,
} from '@/app/(app)/dashboard/actions';

export function QuickActions() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const generate = () =>
    start(async () => {
      setStatus(null);
      try {
        const res = await generateTopicsAction(3);
        setStatus(`Added ${res.inserted} fresh topics to your queue.`);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to generate.');
      }
    });

  const runNow = () =>
    start(async () => {
      setStatus(null);
      try {
        await runPipelineAction({ approvalMode: 'manual' });
        setStatus('Pipeline started — check the library in a minute.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Failed to start pipeline.');
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
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generate 3 topics
        </Button>
        <Button onClick={runNow} disabled={pending} variant="outline">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Run pipeline
        </Button>
      </div>
      {status && (
        <p className="mt-3 text-xs text-muted-foreground">{status}</p>
      )}
    </div>
  );
}
