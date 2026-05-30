'use client';

import { useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  deleteBrandAssetAction,
  extractBrandDnaAction,
  uploadBrandAssetAction,
} from '@/app/(app)/settings/actions';
import {
  BrandDnaReview,
  type ExtractionPayload,
} from '@/components/settings/brand-dna-review';

interface BrandAsset {
  id: string;
  type: string;
  provider: string;
  storage_path: string;
  public_url: string;
  bytes: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.svg,.webp,application/pdf,image/*';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result;
      if (typeof result === 'string') {
        // strip the "data:...;base64," prefix
        const i = result.indexOf(',');
        resolve(i >= 0 ? result.slice(i + 1) : result);
      } else {
        reject(new Error('Read failed'));
      }
    };
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(contentType: string | undefined): typeof FileText {
  if (!contentType) return FileText;
  if (contentType.startsWith('image/')) return ImageIcon;
  return FileText;
}

export function BrandKitUpload({ assets }: { assets: BrandAsset[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Phase 3C — Brand DNA extraction state
  const [extracting, setExtracting] = useState<string | null>(null);
  const [review, setReview] = useState<ExtractionPayload | null>(null);

  const extract = async (asset: BrandAsset) => {
    setErr(null);
    setOk(null);
    setExtracting(asset.id);
    try {
      const result = await extractBrandDnaAction(asset.id);
      setReview({
        assetId: result.assetId,
        evidence: {
          palette: result.evidence.palette,
          pdfTextPreview: result.evidence.pdfTextPreview,
          sourceFilename: result.evidence.sourceFilename,
        },
        proposed: result.proposed,
        extractedAt: result.extractedAt,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Extraction failed.');
    } finally {
      setExtracting(null);
    }
  };

  const handleFile = async (file: File) => {
    setErr(null);
    setOk(null);
    if (file.size > 10 * 1024 * 1024) {
      setErr('File too large (max 10 MB).');
      return;
    }
    let base64: string;
    try {
      base64 = await readFileAsBase64(file);
    } catch {
      setErr('Could not read the file.');
      return;
    }
    start(async () => {
      try {
        await uploadBrandAssetAction({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          data: base64,
        });
        setOk(`Uploaded "${file.name}".`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Upload failed.');
      }
    });
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const remove = (id: string) => {
    if (!confirm('Delete this brand asset? This cannot be undone.')) return;
    setErr(null);
    setOk(null);
    start(async () => {
      try {
        await deleteBrandAssetAction(id);
        setOk('Removed.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Delete failed.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 bg-secondary/20 px-6 py-10 text-center transition hover:border-primary/40"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-flux-soft">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Upload your brand kit</h3>
        <p className="max-w-md text-xs text-muted-foreground">
          Drop logos, brand books, style guides, pitch decks or marketing PDFs here.
          Flux will use them to keep every carousel on-brand.
        </p>
        <p className="text-[11px] text-muted-foreground">
          PDF · PNG · JPG · SVG · WebP · 10 MB max
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="mt-2"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Choose file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* AI extraction notice */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm">
        <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <strong className="text-foreground">Auto-extract brand DNA</strong>
          <span className="block text-xs text-muted-foreground">
            Click <em>Extract</em> on any asset and Flux reads its colors, typography
            cues, tone and voice — then proposes an update to your default brand.
            Review what to accept before it lands.
          </span>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary">
          New
        </Badge>
      </div>

      {/* Existing assets */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Uploaded assets ({assets.length})
          </h3>
          <ul className="space-y-2">
            {assets.map((a) => {
              const ct = (a.metadata?.content_type as string | undefined) ?? undefined;
              const filename = (a.metadata?.original_filename as string | undefined) ?? a.id;
              const Icon = iconFor(ct);
              const isImage = ct?.startsWith('image/');
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-flux-soft">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.public_url}
                        alt={filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{filename}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {prettyBytes(a.bytes)} ·{' '}
                      <a
                        href={a.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => extract(a)}
                    disabled={pending || extracting === a.id}
                    className="gap-1.5"
                    title="Extract brand DNA from this asset"
                  >
                    {extracting === a.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="hidden sm:inline">
                      {extracting === a.id ? 'Extracting…' : 'Extract'}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(a.id)}
                    disabled={pending}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Phase 3C — Review modal mounts on top when a proposal is ready */}
      {review && (
        <BrandDnaReview
          payload={review}
          onClose={() => setReview(null)}
          onApplied={() => {
            setReview(null);
            setOk('Brand DNA applied to your default brand.');
          }}
        />
      )}

      {ok && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4" /> {ok}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" /> {err}
        </div>
      )}
    </div>
  );
}
