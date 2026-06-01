'use client';

/**
 * CampaignCalendar — a month grid of the content_topics queue (Sprint G).
 *
 * Plan a month at a glance: each topic sits on its scheduled day. Reschedule by
 * selecting a topic then clicking a target day (no drag-lib dependency, works
 * on touch). Add a topic to any day, forge a topic straight into the Forge,
 * generate a batch to fill the month, or remove one. Month navigation via
 * ?ym=YYYY-MM.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  addTopicOnDayAction,
  forgeTheMonthAction,
  generateCampaignTopicsAction,
  removeTopicAction,
  rescheduleTopicAction,
} from '@/app/(app)/campaign/actions';
import { beginEngineTask, reportEngineActivity } from '@/lib/use-engine-activity';
import { cn } from '@/lib/utils';

export interface CampaignTopic {
  id: string;
  topic: string;
  post_type: string;
  scheduled_date: string | null;
  status: string;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function isoDay(y: number, m: number, day: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function statusTone(s: string): string {
  switch (s) {
    case 'generated':
      return 'border-state-success/40 bg-state-success/10 text-state-success';
    case 'processing':
      return 'border-flux-cyan/40 bg-flux-cyan/10 text-flux-cyan';
    case 'failed':
      return 'border-state-danger/40 bg-state-danger/10 text-state-danger';
    default:
      return 'border-flux-violet/30 bg-flux-violet/10 text-flux-violet-bright';
  }
}

export function CampaignCalendar({
  topics,
  year,
  month, // 0-indexed
}: {
  topics: CampaignTopic[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [addDay, setAddDay] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [genCount, setGenCount] = useState(8);
  const [busyId, setBusyId] = useState<string | null>(null);

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = first.toLocaleString('en', { month: 'long', year: 'numeric' });

  const byDay = new Map<string, CampaignTopic[]>();
  let unscheduledCount = 0;
  for (const t of topics) {
    if (!t.scheduled_date) {
      unscheduledCount++;
      continue;
    }
    const key = t.scheduled_date.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }

  const goMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    router.push(`/campaign?ym=${ymOf(d)}`);
  };

  const onDayClick = (iso: string) => {
    if (selected) {
      const id = selected;
      setSelected(null);
      setBusyId(id);
      start(async () => {
        try {
          await rescheduleTopicAction(id, iso);
          router.refresh();
        } finally {
          setBusyId(null);
        }
      });
    } else {
      setAddDay(iso);
      setAddText('');
    }
  };

  const submitAdd = () => {
    if (!addText.trim() || !addDay) return;
    const text = addText.trim();
    const day = addDay;
    setAddDay(null);
    setAddText('');
    start(async () => {
      await addTopicOnDayAction(text, day);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setBusyId(id);
    start(async () => {
      try {
        await removeTopicAction(id);
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  };

  const generate = () => {
    setGenOpen(false);
    start(async () => {
      await generateCampaignTopicsAction(genCount);
      router.refresh();
    });
  };

  const pendingCount = topics.filter((t) => t.status === 'pending').length;
  const [batchNote, setBatchNote] = useState<string | null>(null);
  const forgeMonth = () => {
    const done = beginEngineTask('Forging your month of content');
    start(async () => {
      try {
        const res = await forgeTheMonthAction(Math.min(12, pendingCount || 8));
        setBatchNote(
          res.queued > 0
            ? `Forging ${res.queued} carousels in the background — drafts will appear in your Library.`
            : res.message ?? 'Nothing to forge yet.',
        );
        reportEngineActivity(`Started forging ${res.queued} carousels`);
        setTimeout(() => router.refresh(), 1500);
      } finally {
        done();
      }
    });
  };

  // build the grid cells (leading blanks + days)
  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, iso: isoDay(year, month, d) });

  const todayIso = isoDay(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="press inline-flex h-8 w-8 items-center justify-center rounded-sm border border-edge-strong bg-surface-1 text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="font-display text-lg font-semibold tracking-tight">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="press inline-flex h-8 w-8 items-center justify-center rounded-sm border border-edge-strong bg-surface-1 text-fg-muted hover:text-fg"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-flux-violet-bright" />}
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={forgeMonth}
              disabled={pending}
              className="press inline-flex items-center gap-2 rounded-sm border border-flux-violet/40 bg-flux-violet/10 px-3.5 py-2 text-[13px] font-bold text-flux-violet-bright transition hover:bg-flux-violet/20 disabled:opacity-50"
              title={`Forge ${Math.min(12, pendingCount)} pending topics into draft carousels`}
            >
              <Wand2 className="h-4 w-4" /> Forge the month
            </button>
          )}
          <button
            type="button"
            onClick={() => setGenOpen((v) => !v)}
            className="press inline-flex items-center gap-2 rounded-sm bg-flux-gradient px-4 py-2 text-[13px] font-bold text-flux-ink glow-cta"
          >
            <Sparkles className="h-4 w-4" /> Generate topics
          </button>
        </div>
      </div>

      {batchNote && (
        <div className="rounded-sm border border-flux-violet/30 bg-flux-violet/[0.06] px-3 py-2 text-[13px] text-flux-violet-bright">
          {batchNote}
        </div>
      )}

      {/* selection hint */}
      {selected && (
        <div className="flex items-center gap-2 rounded-sm border border-flux-cyan/40 bg-flux-cyan/10 px-3 py-2 text-[13px] text-flux-cyan">
          <Wand2 className="h-3.5 w-3.5" />
          Pick a day to reschedule this topic.
          <button type="button" onClick={() => setSelected(null)} className="ml-auto press">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* generate inline */}
      {genOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-edge-subtle bg-surface-1 p-3">
          <span className="text-[13px] text-fg-muted">How many topics?</span>
          <input
            type="number"
            min={1}
            max={30}
            value={genCount}
            onChange={(e) => setGenCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="h-8 w-16 rounded-sm border border-edge-strong bg-surface-0 px-2 text-sm text-fg outline-none focus:glow-primary"
          />
          <button
            type="button"
            onClick={generate}
            className="press rounded-sm bg-flux-violet/20 px-3 py-1.5 text-[13px] font-semibold text-flux-violet-bright"
          >
            Generate {genCount}
          </button>
          <span className="text-[11px] text-fg-dim">Added unscheduled — drag onto days.</span>
        </div>
      )}

      {/* unscheduled tray */}
      {unscheduledCount > 0 && (
        <div className="rounded-lg border border-edge-subtle bg-surface-1 p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-dim">
            Unscheduled · {unscheduledCount}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topics
              .filter((t) => !t.scheduled_date)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(selected === t.id ? null : t.id)}
                  className={cn(
                    'press max-w-[220px] truncate rounded-pill border px-2.5 py-1 text-[12px]',
                    selected === t.id
                      ? 'border-flux-cyan/60 bg-flux-cyan/15 text-flux-cyan'
                      : statusTone(t.status),
                  )}
                  title={t.topic}
                >
                  {t.topic}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* calendar grid */}
      <div className="overflow-hidden rounded-xl border border-edge-subtle bg-surface-0">
        <div className="grid grid-cols-7 border-b border-edge-subtle">
          {DOW.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-fg-dim">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`b${i}`} className="min-h-[104px] border-b border-r border-edge-subtle/50 bg-surface-0/40" />;
            const items = byDay.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            return (
              <div
                key={cell.iso}
                onClick={() => onDayClick(cell.iso)}
                className={cn(
                  'group min-h-[104px] cursor-pointer border-b border-r border-edge-subtle/50 p-1.5 transition hover:bg-surface-1/50',
                  selected && 'hover:bg-flux-cyan/5',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                      isToday ? 'bg-flux-violet text-flux-ink font-bold' : 'text-fg-dim',
                    )}
                  >
                    {cell.day}
                  </span>
                  <Plus className="h-3 w-3 text-fg-dim opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(selected === t.id ? null : t.id);
                      }}
                      className={cn(
                        'group/topic relative rounded border px-1.5 py-1 text-[11px] leading-tight',
                        selected === t.id ? 'border-flux-cyan/60 bg-flux-cyan/15 text-flux-cyan' : statusTone(t.status),
                      )}
                      title={t.topic}
                    >
                      <span className="line-clamp-2 pr-3">{t.topic}</span>
                      {busyId === t.id ? (
                        <Loader2 className="absolute right-1 top-1 h-3 w-3 animate-spin" />
                      ) : (
                        <span className="absolute right-0.5 top-0.5 flex opacity-0 transition group-hover/topic:opacity-100">
                          <Link
                            href={`/forge?seed=${encodeURIComponent(t.topic)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="press rounded p-0.5 hover:bg-white/10"
                            title="Forge this"
                          >
                            <Wand2 className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(t.id);
                            }}
                            className="press rounded p-0.5 hover:bg-white/10"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="px-1 text-[10px] text-fg-dim">+{items.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* add-on-day inline editor */}
      {addDay && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setAddDay(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-frosted w-full max-w-md rounded-xl border border-edge-strong p-4"
          >
            <div className="mb-2 text-label text-fg-muted">Add a topic · {addDay}</div>
            <textarea
              autoFocus
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitAdd();
              }}
              rows={2}
              placeholder="What's this post about?"
              className="w-full resize-none rounded-sm border border-edge-strong bg-surface-0 p-2.5 text-sm text-fg outline-none focus:glow-primary"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setAddDay(null)} className="press rounded-sm px-3 py-1.5 text-xs text-fg-muted">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdd}
                disabled={!addText.trim()}
                className="press rounded-sm bg-flux-gradient px-3 py-1.5 text-xs font-bold text-flux-ink disabled:opacity-50"
              >
                Add to {addDay}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
