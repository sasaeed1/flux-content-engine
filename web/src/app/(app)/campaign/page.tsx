import { CalendarRange } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { CampaignCalendar, type CampaignTopic } from '@/components/campaign/campaign-calendar';
import { WebsiteTopics } from '@/components/campaign/website-topics';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campaign' };

function parseYm(ym: string | undefined): { year: number; month: number } {
  const now = new Date();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const { year, month } = parseYm(ym);

  // Load the visible month plus a little padding, plus any unscheduled topics.
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const to = `${year}-${String(month + 1).padStart(2, '0')}-31`;

  let topics: CampaignTopic[] = [];
  let error: string | null = null;
  try {
    // Fetch month-scoped scheduled + a broad pull to catch unscheduled (null date).
    const [scoped, all] = await Promise.all([
      api.listTopics(from, to).catch(() => ({ topics: [] })),
      api.listTopics().catch(() => ({ topics: [] })),
    ]);
    const map = new Map<string, CampaignTopic>();
    for (const t of [...scoped.topics, ...all.topics]) {
      // keep month-scoped + unscheduled only (avoid flooding with other months)
      const inMonth = t.scheduled_date && t.scheduled_date.slice(0, 7) === from.slice(0, 7);
      if (inMonth || !t.scheduled_date) map.set(t.id, t as CampaignTopic);
    }
    topics = [...map.values()];
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load topics.';
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plan the month"
        title={
          <>
            <span className="gradient-text">Campaign</span> calendar.
          </>
        }
        subtitle="Map a month of content at a glance. Generate ideas, schedule them across days, then forge each straight into a carousel."
      />

      {error && (
        <div className="rounded-lg border border-state-danger/40 bg-state-danger-bg px-4 py-3 text-sm text-state-danger">
          {error}
        </div>
      )}

      <WebsiteTopics />

      {topics.length === 0 && !error ? (
        <div className="solid-card rounded-2xl p-12 text-center pattern-dots">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-flux-violet/15">
            <CalendarRange className="h-6 w-6 text-flux-violet-bright" />
          </div>
          <p className="mt-3 text-base font-semibold">Plan your first month</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
            Generate a batch of AI topic ideas, drop them onto days, and forge each into a carousel
            when you&apos;re ready.
          </p>
          <div className="mt-5">
            <CampaignCalendar topics={[]} year={year} month={month} />
          </div>
        </div>
      ) : (
        <CampaignCalendar topics={topics} year={year} month={month} />
      )}
    </div>
  );
}
