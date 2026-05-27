'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Pencil,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  rewriteCtaAction,
  setCtaAction,
} from '@/app/(app)/carousels/[id]/edit-actions';

export function CtaEditor({
  carouselId,
  initial,
}: {
  carouselId: string;
  initial: string | null;
}) {
  const [cta, setCta] = useState(initial ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');
  const [variations, setVariations] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const save = () =>
    start(async () => {
      setErr(null);
      try {
        await setCtaAction(carouselId, draft);
        setCta(draft);
        setEditing(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed.');
      }
    });

  const generate = () =>
    start(async () => {
      setErr(null);
      try {
        const res = await rewriteCtaAction(carouselId, 4);
        setVariations(res.ctas);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Generation failed.');
      }
    });

  const pick = (v: string) =>
    start(async () => {
      setErr(null);
      try {
        await setCtaAction(carouselId, v);
        setCta(v);
        setDraft(v);
        setVariations([]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed.');
      }
    });

  return (
    <div className="space-y-3">
      {editing ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
            className="font-medium"
            placeholder="Follow @brand for more"
          />
          <Button variant="primary" size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setDraft(cta);
            }}
            disabled={pending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl glass p-4 text-sm">
          {cta || <span className="text-muted-foreground">No CTA set yet.</span>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(true);
            setDraft(cta);
          }}
          disabled={pending || editing}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Suggest 4 variations
        </Button>
      </div>

      {variations.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border/50 bg-secondary/30 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pick one — overwrites current CTA
          </p>
          <ul className="space-y-1">
            {variations.map((v, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => pick(v)}
                  disabled={pending}
                  className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-flux-soft/60"
                >
                  <span className="flex-1">{v}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
    </div>
  );
}
