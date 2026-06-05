'use client';

/**
 * MediaStudio — Phase 1 of the AI Media Intelligence Studio. Upload images,
 * Flux scores them for quality, ranks them, gives a creative-director verdict,
 * and enhances them on command (auto colour-correct, contrast, sharpen, upscale,
 * brand grade). All processing is server-side + deterministic; the AI directs.
 */
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Download,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  deleteMediaAction,
  enhanceMediaAction,
  mediaDirectorAction,
  uploadMediaAction,
} from '@/app/(app)/media/actions';
import type { DirectorVerdict, MediaAsset } from '@/lib/types';

function scoreColor(n: number): string {
  if (n >= 75) return '#34D399';
  if (n >= 55) return '#F5B544';
  return '#F87171';
}

export function MediaStudio({ assets }: { assets: MediaAsset[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [verdict, setVerdict] = useState<DirectorVerdict | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) {
      setError('Please choose image files.');
      return;
    }
    setError(null);
    setUploading((c) => c + arr.length);
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result);
        start(async () => {
          try {
            await uploadMediaAction({ filename: file.name, contentType: file.type, data });
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload failed.');
          } finally {
            setUploading((c) => Math.max(0, c - 1));
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const runDirector = () => {
    setVerdictPending(true);
    setError(null);
    start(async () => {
      try {
        const res = await mediaDirectorAction();
        setVerdict(res.verdict);
        if (!res.verdict) setError('The director needs at least one analyzed image.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Director unavailable.');
      } finally {
        setVerdictPending(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          drag ? 'border-flux-cyan bg-flux-cyan/5' : 'border-edge-strong hover:border-flux-violet/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-flux-soft">
          {uploading > 0 ? (
            <Loader2 className="h-6 w-6 animate-spin text-flux-violet-bright" />
          ) : (
            <Upload className="h-6 w-6 text-flux-violet-bright" />
          )}
        </div>
        <p className="mt-3 text-base font-semibold">
          {uploading > 0 ? `Analyzing ${uploading} image${uploading === 1 ? '' : 's'}…` : 'Drop images to analyze'}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Flux scores each one for quality, ranks them, and enhances on command. JPG / PNG / WebP · up to 10MB.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{error}</div>}

      {/* AI creative director */}
      {assets.length > 0 && (
        <div className="solid-card space-y-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-flux-violet-bright" />
            <h3 className="text-label text-fg-muted">AI creative director</h3>
            <button
              type="button"
              onClick={runDirector}
              disabled={verdictPending}
              className="press ml-auto inline-flex items-center gap-1.5 rounded-lg border border-edge-strong bg-surface-1 px-3 py-1.5 text-[13px] font-semibold text-fg transition hover:border-flux-violet/50 disabled:opacity-60"
            >
              {verdictPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-flux-violet-bright" />}
              {verdict ? 'Re-review' : 'Review my shots'}
            </button>
          </div>
          {verdict ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{verdict.headline}</p>
              {verdict.hero_pick && (
                <p className="text-[13px] text-flux-cyan">★ Hero pick: {verdict.hero_pick}</p>
              )}
              <ul className="space-y-1">
                {verdict.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-fg-muted">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-flux-violet-bright" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] text-fg-dim">
              Get a decisive verdict on your set — which shot is the hero, which to skip, what to fix.
            </p>
          )}
        </div>
      )}

      {/* Ranked grid */}
      {assets.length === 0 ? (
        <div className="solid-card rounded-2xl p-12 text-center text-sm text-fg-muted pattern-dots">
          No media yet — drop a few photos above and Flux will rank them best-first.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a, i) => (
            <AssetCard key={a.id} asset={a} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, rank }: { asset: MediaAsset; rank: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showEnhanced, setShowEnhanced] = useState(true);
  const [upscale, setUpscale] = useState(true);
  const [grade, setGrade] = useState(true);
  const a = asset.analysis;
  const overall = Math.round(asset.overall_score ?? a?.scores?.social ?? 0);
  const hasEnhanced = Boolean(asset.enhanced_url);
  const img = showEnhanced && hasEnhanced ? asset.enhanced_url! : asset.source_url;
  const applied = asset.metadata?.enhance_applied ?? [];

  const enhance = () =>
    start(async () => {
      try {
        await enhanceMediaAction(asset.id, { upscale, brandGrade: grade, intensity: 0.85 });
        router.refresh();
      } finally {
        /* refresh handles it */
      }
    });
  const remove = () => {
    if (!confirm('Remove this asset?')) return;
    start(async () => {
      await deleteMediaAction(asset.id);
      router.refresh();
    });
  };

  const bars: Array<[string, number]> = a?.scores
    ? [
        ['Sharpness', a.scores.sharpness],
        ['Exposure', a.scores.exposure],
        ['Contrast', a.scores.contrast],
        ['Resolution', a.scores.resolution],
        ['Composition', a.scores.composition],
      ]
    : [];

  return (
    <div className="overflow-hidden rounded-xl border border-edge-subtle bg-surface-1">
      <div className="relative aspect-[4/5] w-full bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Image src={img} alt={asset.filename ?? 'asset'} fill unoptimized className="object-cover" sizes="(max-width:768px) 50vw, 33vw" />
        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
          #{rank}
        </div>
        <div
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-flux-ink"
          style={{ background: scoreColor(overall) }}
          title="Overall social-suitability score"
        >
          {overall}
        </div>
        {hasEnhanced && (
          <button
            type="button"
            onClick={() => setShowEnhanced((v) => !v)}
            className="press absolute bottom-2 left-2 rounded-pill bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"
          >
            {showEnhanced ? 'Showing: Enhanced' : 'Showing: Original'}
          </button>
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium" title={asset.filename ?? ''}>
            {asset.filename ?? 'image'}
          </span>
          <span className="shrink-0 text-[11px] text-fg-dim">
            {asset.width}×{asset.height}
          </span>
        </div>

        <div className="space-y-1.5">
          {bars.map(([label, val]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-fg-dim">{label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full" style={{ width: `${val}%`, background: scoreColor(val) }} />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-[10px] text-fg-muted">{val}</span>
            </div>
          ))}
        </div>

        {(a?.flags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {a.flags.map((f) => (
              <span key={f} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                {f}
              </span>
            ))}
          </div>
        )}

        {applied.length > 0 && (
          <p className="text-[10px] text-emerald-300/90">✓ {applied.join(' · ')}</p>
        )}

        {/* Enhance controls */}
        <div className="flex flex-wrap items-center gap-2 border-t border-edge-subtle pt-2.5">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            <input type="checkbox" checked={upscale} onChange={(e) => setUpscale(e.target.checked)} className="accent-flux-violet" />
            Upscale
          </label>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            <input type="checkbox" checked={grade} onChange={(e) => setGrade(e.target.checked)} className="accent-flux-violet" />
            Brand grade
          </label>
          <button
            type="button"
            onClick={enhance}
            disabled={pending}
            className="press ml-auto inline-flex items-center gap-1.5 rounded-sm bg-flux-gradient px-3 py-1.5 text-[12px] font-bold text-flux-ink glow-cta disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {hasEnhanced ? 'Re-enhance' : 'Enhance'}
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {hasEnhanced && (
            <a href={asset.enhanced_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-flux-cyan hover:underline">
              <Download className="h-3 w-3" /> Download enhanced
            </a>
          )}
          <button type="button" onClick={remove} disabled={pending} className="press ml-auto inline-flex items-center gap-1 text-fg-dim hover:text-red-300">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}
