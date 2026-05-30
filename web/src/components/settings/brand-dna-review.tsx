'use client';

/**
 * Brand DNA Review modal — Phase 3C.
 *
 * Renders the proposed brand DNA returned from the extractor and lets the user
 * pick which slots to accept. On apply, calls applyBrandDnaAction with the
 * accepted slot list so the server merges only those into the default brand.
 *
 * The visual leans on the same gradient ring / glassy panel language as the
 * rest of Flux's premium surfaces. Each accepted slot animates in; rejected
 * slots dim out.
 */
import { useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Palette,
  Sparkles,
  Type,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { applyBrandDnaAction } from '@/app/(app)/settings/actions';

export interface ProposedDna {
  colors: Partial<{
    background: string;
    foreground: string;
    accent: string;
    accentSoft: string;
    muted: string;
  }>;
  typography: Partial<{ fontPrimary: string; fontDisplay: string }>;
  tone?: string;
  postStyle?: string;
  ctaStyle?: string;
  voiceKeywords: string[];
  voiceAvoid: string[];
  summary?: string;
  confidence?: number;
}

export interface ExtractionPayload {
  assetId: string;
  evidence: {
    palette: string[];
    pdfTextPreview: string | null;
    sourceFilename: string | null;
  };
  proposed: ProposedDna;
  extractedAt: string;
}

type SlotKey =
  | 'colors'
  | 'typography'
  | 'tone'
  | 'postStyle'
  | 'ctaStyle'
  | 'voiceKeywords'
  | 'voiceAvoid';

const ALL_SLOTS: SlotKey[] = [
  'colors',
  'typography',
  'tone',
  'postStyle',
  'ctaStyle',
  'voiceKeywords',
  'voiceAvoid',
];

function ColorSwatch({ hex, label }: { hex: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5">
      <span
        className="h-5 w-5 shrink-0 rounded-md ring-1 ring-border/60"
        style={{ background: hex }}
        aria-hidden
      />
      <span className="text-[11px] font-mono tracking-tight">{hex}</span>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

export function BrandDnaReview({
  payload,
  onClose,
  onApplied,
}: {
  payload: ExtractionPayload;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { proposed, evidence } = payload;
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Default-accept whichever slots the proposal actually filled.
  const initialAccept = useMemo<SlotKey[]>(() => {
    const out: SlotKey[] = [];
    if (Object.keys(proposed.colors).length > 0) out.push('colors');
    if (Object.keys(proposed.typography).length > 0) out.push('typography');
    if (proposed.tone) out.push('tone');
    if (proposed.postStyle) out.push('postStyle');
    if (proposed.ctaStyle) out.push('ctaStyle');
    if (proposed.voiceKeywords.length > 0) out.push('voiceKeywords');
    if (proposed.voiceAvoid.length > 0) out.push('voiceAvoid');
    return out;
  }, [proposed]);

  const [accept, setAccept] = useState<Set<SlotKey>>(new Set(initialAccept));

  const toggle = (k: SlotKey) => {
    const next = new Set(accept);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setAccept(next);
  };

  const apply = () => {
    setErr(null);
    start(async () => {
      try {
        await applyBrandDnaAction({
          proposed: proposed as unknown as Record<string, unknown>,
          accept: [...accept],
        });
        onApplied();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Apply failed.');
      }
    });
  };

  const confidencePct = Math.round((proposed.confidence ?? 0) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: 'rgba(5, 5, 12, 0.72)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient ring header */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(167,139,250,0.6), rgba(34,211,238,0.6), transparent)',
          }}
        />
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-flux-soft">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Brand DNA proposal</h3>
              <p className="text-[11px] text-muted-foreground">
                Extracted from{' '}
                <span className="font-medium text-foreground">
                  {evidence.sourceFilename ?? 'asset'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {typeof proposed.confidence === 'number' && (
              <Badge variant="outline" className="text-[10px]">
                {confidencePct}% confidence
              </Badge>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
          {/* Summary */}
          {proposed.summary && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                <Sparkles className="h-3 w-3" /> AI summary
              </div>
              <p className="leading-relaxed">{proposed.summary}</p>
            </div>
          )}

          {/* Colors */}
          {Object.keys(proposed.colors).length > 0 && (
            <Slot
              k="colors"
              icon={Palette}
              title="Color palette"
              accepted={accept.has('colors')}
              onToggle={toggle}
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(proposed.colors).map(([role, hex]) =>
                  hex ? <ColorSwatch key={role} hex={hex} label={role} /> : null,
                )}
              </div>
              {evidence.palette.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground">
                    Raw extracted palette
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidence.palette.map((p) => (
                      <ColorSwatch key={p} hex={p} />
                    ))}
                  </div>
                </details>
              )}
            </Slot>
          )}

          {/* Typography */}
          {Object.keys(proposed.typography).length > 0 && (
            <Slot
              k="typography"
              icon={Type}
              title="Typography"
              accepted={accept.has('typography')}
              onToggle={toggle}
            >
              <div className="grid grid-cols-2 gap-2 text-sm">
                {proposed.typography.fontDisplay && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Display
                    </div>
                    <div
                      className="text-base font-bold"
                      style={{ fontFamily: proposed.typography.fontDisplay }}
                    >
                      {proposed.typography.fontDisplay}
                    </div>
                  </div>
                )}
                {proposed.typography.fontPrimary && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Primary
                    </div>
                    <div
                      className="text-base"
                      style={{ fontFamily: proposed.typography.fontPrimary }}
                    >
                      {proposed.typography.fontPrimary}
                    </div>
                  </div>
                )}
              </div>
            </Slot>
          )}

          {/* Tone */}
          {proposed.tone && (
            <Slot
              k="tone"
              icon={Sparkles}
              title="Voice / tone"
              accepted={accept.has('tone')}
              onToggle={toggle}
            >
              <p className="text-sm leading-relaxed">{proposed.tone}</p>
            </Slot>
          )}

          {/* Post style + CTA */}
          {(proposed.postStyle || proposed.ctaStyle) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {proposed.postStyle && (
                <Slot
                  k="postStyle"
                  icon={Sparkles}
                  title="Post style"
                  accepted={accept.has('postStyle')}
                  onToggle={toggle}
                  compact
                >
                  <Badge variant="outline" className="text-xs capitalize">
                    {proposed.postStyle}
                  </Badge>
                </Slot>
              )}
              {proposed.ctaStyle && (
                <Slot
                  k="ctaStyle"
                  icon={Sparkles}
                  title="CTA style"
                  accepted={accept.has('ctaStyle')}
                  onToggle={toggle}
                  compact
                >
                  <p className="text-xs italic">"{proposed.ctaStyle}"</p>
                </Slot>
              )}
            </div>
          )}

          {/* Voice keywords */}
          {proposed.voiceKeywords.length > 0 && (
            <Slot
              k="voiceKeywords"
              icon={Sparkles}
              title="Voice keywords"
              accepted={accept.has('voiceKeywords')}
              onToggle={toggle}
            >
              <div className="flex flex-wrap gap-1.5">
                {proposed.voiceKeywords.map((w) => (
                  <Badge key={w} variant="outline" className="text-[11px]">
                    {w}
                  </Badge>
                ))}
              </div>
            </Slot>
          )}

          {/* Voice avoid */}
          {proposed.voiceAvoid.length > 0 && (
            <Slot
              k="voiceAvoid"
              icon={AlertCircle}
              title="Avoid"
              accepted={accept.has('voiceAvoid')}
              onToggle={toggle}
            >
              <div className="flex flex-wrap gap-1.5">
                {proposed.voiceAvoid.map((w) => (
                  <Badge
                    key={w}
                    variant="outline"
                    className="border-red-500/40 bg-red-500/10 text-[11px] text-red-200"
                  >
                    {w}
                  </Badge>
                ))}
              </div>
            </Slot>
          )}

          {/* Empty states */}
          {ALL_SLOTS.every((k) =>
            k === 'colors'
              ? Object.keys(proposed.colors).length === 0
              : k === 'typography'
                ? Object.keys(proposed.typography).length === 0
                : k === 'voiceKeywords'
                  ? proposed.voiceKeywords.length === 0
                  : k === 'voiceAvoid'
                    ? proposed.voiceAvoid.length === 0
                    : !proposed[k as 'tone' | 'postStyle' | 'ctaStyle'],
          ) && (
            <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
              The extractor couldn&apos;t propose anything actionable from this
              asset. Try uploading a logo image or a brand book PDF instead.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-card/60 px-5 py-3">
          <div className="text-[11px] text-muted-foreground">
            {accept.size} of {ALL_SLOTS.length} slots will be applied to your default brand
          </div>
          <div className="flex items-center gap-2">
            {err && (
              <span className="text-xs text-red-300">
                <AlertCircle className="mr-1 inline h-3 w-3" /> {err}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={apply} disabled={pending || accept.size === 0}>
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Apply to brand
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slot({
  k,
  icon: Icon,
  title,
  accepted,
  onToggle,
  compact = false,
  children,
}: {
  k: SlotKey;
  icon: typeof Sparkles;
  title: string;
  accepted: boolean;
  onToggle: (k: SlotKey) => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border px-4 ${compact ? 'py-2.5' : 'py-3'} transition ${
        accepted
          ? 'border-primary/30 bg-primary/[0.04]'
          : 'border-border/40 bg-card/30 opacity-60'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={() => onToggle(k)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-border/60 accent-primary"
          />
          <span className="text-muted-foreground">Apply</span>
        </label>
      </div>
      {children}
    </div>
  );
}
