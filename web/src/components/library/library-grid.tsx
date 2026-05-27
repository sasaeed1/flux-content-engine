'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Square,
  SquareCheckBig,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CarouselGridCard } from './carousel-grid-card';
import { bulkApproveAction } from '@/app/(app)/carousels/[id]/edit-actions';
import type { CarouselRow } from '@/lib/types';

// Only carousels in 'ready' status are eligible for bulk approval.
const APPROVABLE = new Set(['ready', 'ready_for_review', 'pending_approval']);

export function LibraryGrid({ carousels }: { carousels: CarouselRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    | { ok: number; failed: number; errors: Array<{ id: string; error: string }> }
    | null
  >(null);

  const eligible = useMemo(
    () => carousels.filter((c) => APPROVABLE.has(c.status)),
    [carousels],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(eligible.map((c) => c.id)));
  const clear = () => setSelected(new Set());

  const approve = () =>
    start(async () => {
      setResult(null);
      try {
        const res = await bulkApproveAction(Array.from(selected));
        const ok = res.results.filter((r) => r.ok).length;
        const errors = res.results
          .filter((r) => !r.ok)
          .map((r) => ({ id: r.id, error: r.error ?? 'unknown' }));
        setResult({ ok, failed: errors.length, errors });
        if (errors.length === 0) setSelected(new Set());
      } catch (e) {
        setResult({
          ok: 0,
          failed: selected.size,
          errors: [{ id: '*', error: e instanceof Error ? e.message : 'Request failed' }],
        });
      }
    });

  const selectionActive = selected.size > 0;

  return (
    <div className="space-y-4">
      {/* Bulk actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          {selectionActive ? (
            <>
              <Badge variant="accent">
                {selected.size} selected
              </Badge>
              <button
                onClick={clear}
                className="text-xs text-muted-foreground hover:text-foreground"
                disabled={pending}
              >
                Clear
              </button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Click the circle on a card to bulk-select. {eligible.length} carousel
              {eligible.length === 1 ? '' : 's'} ready to approve.
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {eligible.length > 0 && !selectionActive && (
            <Button variant="outline" size="sm" onClick={selectAll}>
              <SquareCheckBig className="h-3.5 w-3.5" /> Select all ready
            </Button>
          )}
          {selectionActive && (
            <Button
              variant="primary"
              size="sm"
              onClick={approve}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Approve {selected.size}
            </Button>
          )}
        </div>
      </div>

      {/* Result strip */}
      {result && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            result.failed === 0
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          }`}
        >
          {result.failed === 0 ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="flex-1">
            <div>
              Approved <strong>{result.ok}</strong>
              {result.failed > 0 && (
                <>
                  {' '}· <strong>{result.failed} failed</strong>
                </>
              )}
              .
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i} className="opacity-80">
                    <code className="font-mono">{e.id.slice(0, 8)}</code>: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            aria-label="Dismiss"
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {carousels.map((c) => {
          const isEligible = APPROVABLE.has(c.status);
          const checked = selected.has(c.id);
          return (
            <div key={c.id} className="relative">
              {/* Bulk-select checkbox — only on eligible carousels */}
              {isEligible && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(c.id);
                  }}
                  className={`absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur transition ${
                    checked
                      ? 'border-primary bg-primary text-background'
                      : 'border-white/30 bg-black/40 text-white opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label={checked ? 'Deselect' : 'Select'}
                >
                  {checked ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <div className={`group ${checked ? 'ring-2 ring-primary rounded-2xl' : ''}`}>
                {/* Link is provided by the card itself */}
                <CarouselGridCard row={c} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
