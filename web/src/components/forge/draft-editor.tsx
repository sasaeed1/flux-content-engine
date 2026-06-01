'use client';

/**
 * DraftEditor — Sprint D inline-edit-during-gen.
 *
 * When the Forge runs in "Draft first" mode, generation stops at the script:
 * each slide's text is shown as an editable card BEFORE any pixels are
 * rendered. Edit a hook, tighten a line, fix a typo — then hit "Render slides"
 * and Flux materializes the (edited) carousel in one pass. Closes the audit's
 * "no edit during generation" gap with a clean draft→edit→render flow.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, PencilLine, Sparkles } from 'lucide-react';
import { renderDraftAction, saveDraftSlideAction } from '@/app/(app)/forge/actions';
import { beginEngineTask, reportEngineActivity } from '@/lib/use-engine-activity';

interface DraftSlide {
  index: number;
  role: string;
  layout: string;
  data: Record<string, unknown>;
}

/** Which keys in a slide's data are editable free-text (vs structural). */
function editableEntries(data: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && v.trim().length > 0) out.push([k, v]);
  }
  return out;
}

export function DraftEditor({
  carouselId,
  slides,
}: {
  carouselId: string;
  slides: DraftSlide[];
}) {
  const router = useRouter();
  // Local working copy of each slide's editable fields.
  const [draft, setDraft] = useState<Record<number, Record<string, string>>>(() => {
    const init: Record<number, Record<string, string>> = {};
    for (const s of slides) {
      init[s.index] = Object.fromEntries(editableEntries(s.data ?? {}));
    }
    return init;
  });
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [rendering, startRender] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onField = (idx: number, key: string, value: string) => {
    setDraft((d) => ({ ...d, [idx]: { ...d[idx], [key]: value } }));
  };

  // Persist a slide's edited data when the user leaves a field.
  const saveSlide = async (slide: DraftSlide) => {
    setSavingIdx(slide.index);
    try {
      const merged = { ...(slide.data ?? {}), ...(draft[slide.index] ?? {}) };
      await saveDraftSlideAction(carouselId, slide.index, merged);
    } catch {
      /* non-fatal — render will re-read whatever persisted */
    } finally {
      setSavingIdx(null);
    }
  };

  const renderAll = () => {
    setErr(null);
    const done = beginEngineTask('Rendering your edited slides');
    startRender(async () => {
      try {
        // Make sure every slide's latest edits are persisted first.
        await Promise.all(slides.map((s) => saveSlide(s)));
        await renderDraftAction(carouselId);
        reportEngineActivity('Rendered an edited carousel');
        router.push(`/library/${carouselId}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Render failed.');
      } finally {
        done();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PencilLine className="h-4 w-4 text-flux-violet-bright" />
          <h3 className="font-display text-base font-semibold">Edit the draft</h3>
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-fg-muted">
            {slides.length} slides
          </span>
        </div>
        <button
          type="button"
          onClick={renderAll}
          disabled={rendering}
          className="press inline-flex items-center gap-2 rounded-sm bg-flux-gradient px-4 py-2 text-[13px] font-bold text-flux-ink glow-cta disabled:opacity-50"
        >
          {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Render slides
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[13px] text-fg-muted">
        Tweak any line before it&apos;s rendered. Changes save as you go; hit{' '}
        <span className="text-fg">Render slides</span> when you&apos;re happy.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {slides.map((s) => {
          const fields = editableEntries(s.data ?? {});
          return (
            <div key={s.index} className="solid-card rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-flux-violet-bright">
                  {s.role} · slide {s.index + 1}
                </span>
                {savingIdx === s.index && (
                  <Loader2 className="h-3 w-3 animate-spin text-fg-dim" />
                )}
              </div>
              <div className="space-y-2.5">
                {fields.length === 0 && (
                  <p className="text-[12px] text-fg-dim">No editable text on this slide.</p>
                )}
                {fields.map(([key]) => {
                  const val = draft[s.index]?.[key] ?? '';
                  const long = val.length > 48;
                  return (
                    <label key={key} className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-wider text-fg-dim">
                        {key}
                      </span>
                      {long ? (
                        <textarea
                          value={val}
                          onChange={(e) => onField(s.index, key, e.target.value)}
                          onBlur={() => saveSlide(s)}
                          rows={2}
                          className="w-full resize-none rounded-sm border border-edge-strong bg-surface-0 p-2 text-[13px] text-fg outline-none focus:glow-primary"
                        />
                      ) : (
                        <input
                          value={val}
                          onChange={(e) => onField(s.index, key, e.target.value)}
                          onBlur={() => saveSlide(s)}
                          className="w-full rounded-sm border border-edge-strong bg-surface-0 p-2 text-[13px] text-fg outline-none focus:glow-primary"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {err && <p className="text-xs text-state-danger">{err}</p>}
    </div>
  );
}
