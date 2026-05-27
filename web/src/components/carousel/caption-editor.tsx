'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pencil,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  rewriteCaptionAction,
  setCaptionAction,
} from '@/app/(app)/carousels/[id]/edit-actions';

type Style =
  | 'shorter'
  | 'longer'
  | 'professional'
  | 'casual'
  | 'aggressive'
  | 'stronger-cta'
  | 'rewrite';

const STYLE_OPTIONS: Array<{ value: Style; label: string; hint: string }> = [
  { value: 'shorter', label: 'Make it shorter', hint: '~60% length, same CTA' },
  { value: 'longer', label: 'Make it longer', hint: 'Add one value line' },
  { value: 'professional', label: 'More professional', hint: 'B2B tone' },
  { value: 'casual', label: 'More casual', hint: 'Founder-to-friend' },
  { value: 'aggressive', label: 'More punchy', hint: 'Shorter sentences' },
  { value: 'stronger-cta', label: 'Stronger CTA', hint: 'Sharper close' },
  { value: 'rewrite', label: 'Rewrite from scratch', hint: 'Same value, new words' },
];

export function CaptionEditor({
  carouselId,
  initial,
}: {
  carouselId: string;
  initial: string | null;
}) {
  const [caption, setCaption] = useState(initial ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const saveEdit = () =>
    start(async () => {
      setErr(null);
      setOk(null);
      try {
        const res = await setCaptionAction(carouselId, draft);
        setCaption(res.caption);
        setEditing(false);
        setOk('Caption saved.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed.');
      }
    });

  const runRewrite = (style: Style) =>
    start(async () => {
      setErr(null);
      setOk(null);
      setMenuOpen(false);
      try {
        const res = await rewriteCaptionAction(carouselId, style);
        setCaption(res.caption);
        setDraft(res.caption);
        setOk('Caption rewritten.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Rewrite failed.');
      }
    });

  if (editing) {
    return (
      <div className="space-y-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          disabled={pending}
          className="font-normal leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {draft.length} / 2200 characters
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(caption);
                setErr(null);
              }}
              disabled={pending}
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={saveEdit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="h-3.5 w-3.5" /> {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="whitespace-pre-wrap rounded-2xl glass p-5 text-sm leading-relaxed">
        {caption || (
          <span className="text-muted-foreground">No caption written yet.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(true);
            setDraft(caption);
          }}
          disabled={pending}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>

        {/* AI rewrite dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Rewrite with AI
            <ChevronDown className="h-3 w-3" />
          </Button>
          {menuOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <ul className="divide-y divide-border/40">
                {STYLE_OPTIONS.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => runRewrite(o.value)}
                      className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-muted/40"
                    >
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary opacity-70 group-hover:opacity-100" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{o.label}</div>
                        <div className="text-xs text-muted-foreground">{o.hint}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {ok && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> {ok}
          </span>
        )}
      </div>

      {err && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
    </div>
  );
}
