'use client';

/**
 * AI Presence Cards — the visible heartbeat of the intelligence layer.
 *
 * Three variants:
 *   - trend         (gradient teal)  — "X is rising in your niche"
 *   - optimization  (amber)          — "Y could be sharper"
 *   - next-action   (violet→pink)    — "Try this next"
 *
 * Cards are dismissible. Click the CTA → router push. Auto-expire after 24h
 * server-side; the engine refreshes them on schedule.
 */
import Link from 'next/link';
import { useTransition } from 'react';
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from 'lucide-react';

export interface InsightCard {
  id: string;
  kind: string;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  score: number;
}

const KIND_STYLE: Record<
  string,
  {
    icon: typeof TrendingUp;
    accent: string;
    bg: string;
    border: string;
    iconBg: string;
    label: string;
  }
> = {
  trend: {
    icon: TrendingUp,
    accent: '#22D3EE',
    bg: 'linear-gradient(135deg, rgba(34,211,238,0.10), rgba(34,211,238,0.04) 60%, transparent)',
    border: 'rgba(34,211,238,0.35)',
    iconBg: 'rgba(34,211,238,0.18)',
    label: 'Trend',
  },
  optimization: {
    icon: Wand2,
    accent: '#FBBF24',
    bg: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(251,191,36,0.04) 60%, transparent)',
    border: 'rgba(251,191,36,0.35)',
    iconBg: 'rgba(251,191,36,0.18)',
    label: 'Optimize',
  },
  'next-action': {
    icon: Zap,
    accent: '#A78BFA',
    bg: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(236,72,153,0.04) 60%, transparent)',
    border: 'rgba(167,139,250,0.35)',
    iconBg: 'rgba(167,139,250,0.18)',
    label: 'Next action',
  },
};

function PresenceCardRow({
  insight,
  onDismiss,
}: {
  insight: InsightCard;
  onDismiss: (id: string) => void;
}) {
  const style = KIND_STYLE[insight.kind] ?? KIND_STYLE['next-action'];
  const Icon = style.icon;
  const [pending, start] = useTransition();

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 16px 32px -20px ${style.accent}45`,
      }}
    >
      {/* Soft glow on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 30% -20%, ${style.accent}30, transparent 65%)`,
        }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: style.iconBg, color: style.accent }}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: style.accent }}
            >
              {style.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              · score {Math.round(insight.score * 100)}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground">
            {insight.headline}
          </h3>
          {insight.body && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {insight.body}
            </p>
          )}
          {insight.cta_label && insight.cta_href && (
            <Link
              href={insight.cta_href}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition hover:gap-2.5"
              style={{ color: style.accent }}
            >
              {insight.cta_label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => start(() => onDismiss(insight.id))}
          disabled={pending}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground/60 transition hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PresenceCards({
  insights,
  onDismiss,
}: {
  insights: InsightCard[];
  onDismiss: (id: string) => void;
}) {
  if (!insights.length) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-4 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-primary opacity-60" />
        <p className="mt-2 text-xs text-muted-foreground">
          Flux is observing your workspace.
          <br />
          Insights appear here as you produce content.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {insights.map((i) => (
        <PresenceCardRow key={i.id} insight={i} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
