'use client';

/**
 * Slide diff card — post-audit #4.
 *
 * After an AI slide rewrite, show the BEFORE and AFTER side by side with
 * field-level highlights so the user can keep, revert, or rewrite again.
 *
 * Receives both versions from the /slides/:idx/rewrite endpoint. The new
 * version is already persisted (the engine applies it before returning),
 * so "Revert" calls setSlide with the previous data to roll back.
 */
import { useState, useTransition } from 'react';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';
import { setSlideAction } from '@/app/(app)/carousels/[id]/edit-actions';

export interface SlideVersion {
  index: number;
  role: string;
  layout: string;
  data: Record<string, unknown>;
}

interface Props {
  carouselId: string;
  previous: SlideVersion;
  next: SlideVersion;
  style: string;
  onClose: () => void;
  onReverted?: () => void;
}

/**
 * Recursively renders a key/value tree of slide data with the changed values
 * highlighted in primary color. Most slide data is shallow (a few text
 * fields), but list-layout slides nest arrays — we handle one level of
 * arrays/objects gracefully.
 */
function renderField(key: string, value: unknown, changed: boolean): React.ReactNode {
  const labelClass =
    'text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground';
  const valueClass = changed
    ? 'rounded-md bg-primary/15 px-2 py-1 text-sm text-foreground ring-1 ring-primary/40'
    : 'text-sm text-foreground/90';

  if (Array.isArray(value)) {
    return (
      <div key={key}>
        <div className={labelClass}>{key}</div>
        <ul className="mt-1 space-y-1">
          {value.map((v, i) => (
            <li
              key={i}
              className={`${valueClass} list-inside list-disc`}
            >
              {typeof v === 'object' && v !== null
                ? JSON.stringify(v)
                : String(v ?? '')}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div key={key}>
        <div className={labelClass}>{key}</div>
        <pre className={`${valueClass} whitespace-pre-wrap text-xs`}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }
  return (
    <div key={key}>
      <div className={labelClass}>{key}</div>
      <div className={valueClass}>{String(value ?? '')}</div>
    </div>
  );
}

function panelFor(version: SlideVersion, other: SlideVersion, label: 'Before' | 'After') {
  const data = version.data ?? {};
  const otherData = other.data ?? {};
  const keys = Array.from(
    new Set([...Object.keys(data), ...Object.keys(otherData)]),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em]">
        <span
          className={
            label === 'Before' ? 'text-muted-foreground' : 'text-primary'
          }
        >
          {label}
        </span>
        <span className="text-muted-foreground">{version.layout}</span>
      </div>
      <div className="space-y-2.5 rounded-xl border border-border/40 bg-card/40 px-3 py-3">
        {keys.map((k) => {
          const before = JSON.stringify(data[k] ?? null);
          const after = JSON.stringify(otherData[k] ?? null);
          const changed = label === 'After' && before !== after;
          return renderField(k, data[k], changed);
        })}
      </div>
    </div>
  );
}

export function SlideDiff({
  carouselId,
  previous,
  next,
  style,
  onClose,
  onReverted,
}: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const revert = () => {
    setErr(null);
    start(async () => {
      try {
        await setSlideAction(carouselId, previous.index, previous.data);
        onReverted?.();
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Revert failed.');
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: 'rgba(5,5,12,0.72)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), rgba(34,211,238,0.6), transparent)',
          }}
        />
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">
              Slide {previous.index + 1} — review the {style} rewrite
            </h3>
            <p className="text-[11px] text-muted-foreground">
              The new version is already saved. Keep it, revert, or rewrite again.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">
          {panelFor(previous, next, 'Before')}
          {panelFor(next, previous, 'After')}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-card/60 px-5 py-3">
          {err ? (
            <span className="text-xs text-red-300">{err}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Highlighted fields changed. Other fields are identical.
            </span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={revert}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-muted/40 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Revert to before
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <CheckCircle2 className="h-3 w-3" />
              Keep new
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
