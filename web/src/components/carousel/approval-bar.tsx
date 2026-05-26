'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { approveCarouselAction } from '@/app/(app)/carousels/[id]/actions';

const PUBLISHED = new Set(['published', 'publishing', 'scheduled', 'approved']);

export function ApprovalBar({
  carouselId,
  status,
}: {
  carouselId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [publishAt, setPublishAt] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const alreadyPublished = PUBLISHED.has(status);

  const approve = () =>
    start(async () => {
      setErr(null);
      try {
        await approveCarouselAction(carouselId, publishAt || undefined);
        setDone(
          publishAt
            ? `Scheduled for ${new Date(publishAt).toLocaleString()}.`
            : 'Approved — queued for the next publish slot.',
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Approval failed.');
      }
    });

  if (alreadyPublished && !done) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <CheckCircle2 className="h-4 w-4" />
        <span>
          Already{' '}
          <Badge variant="success" className="ml-1">
            {status.replace(/_/g, ' ')}
          </Badge>
          . Sit back — Flux is handling it.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass p-5 min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        <Send className="mt-1 h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Approve & publish
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve to queue this carousel. Optionally pick a publish time, or
            leave blank for the next open slot.
          </p>
          {/* Stack vertically — the aside column is narrow; horizontal layout overflows. */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="publishAt">Publish at</Label>
              <Input
                id="publishAt"
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                disabled={pending}
                className="w-full"
              />
            </div>
            <Button
              onClick={approve}
              disabled={pending}
              variant="primary"
              size="lg"
              className="w-full justify-center"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishAt ? 'Schedule' : 'Approve now'}
            </Button>
          </div>
          {done && <p className="mt-3 text-sm text-emerald-300 break-words">✓ {done}</p>}
          {err && <p className="mt-3 text-sm text-red-300 break-words">{err}</p>}
        </div>
      </div>
    </div>
  );
}
