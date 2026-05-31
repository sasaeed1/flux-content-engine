'use client';

/**
 * Opportunity / Insight card — the canonical AI-presence surface.
 *
 * One card used everywhere the engine surfaces something worth doing: the Home
 * Opportunity Feed, the Copilot drawer, inline suggestions. Four kinds, each
 * with an owned color and meaning:
 *   - trend         (cyan)   — "X is rising in your niche"
 *   - optimization  (gold)   — "Y could be sharper"
 *   - next-action   (violet) — "Resume / try this next"
 *   - discovery     (violet→cyan) — "A new style fits your brand"
 *
 * Each carries a confidence ring, a one-click action that typically deep-links
 * into the Forge pre-seeded, and a dismiss. Cards stagger-reveal when listed.
 */
import Link from 'next/link';
import { useTransition } from 'react';
import { ArrowRight, Compass, Sparkles, TrendingUp, Wand2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InsightCard {
  id: string;
  kind: string;
  headline: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  score: number;
}

type KindStyle = {
  icon: typeof TrendingUp;
  accent: string;
  bg: string;
  border: string;
  iconBg: string;
  label: string;
  ring: string;
};

const KIND_STYLE: Record<string, KindStyle> = {
  trend: {
    icon: TrendingUp,
    accent: '#22D3EE',
    bg: 'linear-gradient(135deg, rgba(34,211,238,0.10), rgba(34,211,238,0.03) 60%, transparent)',
    border: 'rgba(34,211,238,0.30)',
    iconBg: 'rgba(34,211,238,0.16)',
    ring: '#22D3EE',
    label: 'Trend',
  },
  optimization: {
    icon: Wand2,
    accent: '#F5B544',
    bg: 'linear-gradient(135deg, rgba(245,181,68,0.10), rgba(245,181,68,0.03) 60%, transparent)',
    border: 'rgba(245,181,68,0.30)',
    iconBg: 'rgba(245,181,68,0.16)',
    ring: '#F5B544',
    label: 'Optimize',
  },
  'next-action': {
    icon: Zap,
    accent: '#A78BFA',
    bg: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(236,72,153,0.03) 60%, transparent)',
    border: 'rgba(167,139,250,0.30)',
    iconBg: 'rgba(167,139,250,0.16)',
    ring: '#A78BFA',
    label: 'Next action',
  },
  discovery: {
    icon: Compass,
    accent: '#8B5CF6',
    bg: 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(34,211,238,0.04) 70%, transparent)',
    border: 'rgba(139,92,246,0.30)',
    iconBg: 'rgba(139,92,246,0.16)',
    ring: '#8B5CF6',
    label: 'Discovery',
  },
};

/** Small SVG confidence ring (0..1). */
function ConfidenceRing({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(1, score));
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-6 w-6 items-center justify-center" title={`${Math.round(pct * 100)}% confidence`}>
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
        <circle
          cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="absolute font-mono text-[8px] font-bold text-fg-muted">
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}

export function PresenceCard({
  insight,
  onDismiss,
  variant = 'solid',
  index = 0,
}: {
  insight: InsightCard;
  onDismiss?: (id: string) => void;
  variant?: 'solid' | 'glass' | 'compact';
  index?: number;
}) {
  const style = KIND_STYLE[insight.kind] ?? KIND_STYLE['next-action'];
  const Icon = style.icon;
  const [pending, start] = useTransition();
  const compact = variant === 'compact';

  return (
    <div
      className={cn(
        'group press relative animate-fade-up overflow-hidden rounded-lg border transition hover:-translate-y-0.5',
        compact ? 'p-3' : 'p-4',
        variant === 'glass' && 'glass',
      )}
      style={{
        background: variant === 'glass' ? undefined : style.bg,
        borderColor: style.border,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 16px 32px -22px ${style.accent}50`,
        animationDelay: `${Math.min(index, 12) * 55}ms`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 30% -20%, ${style.accent}28, transparent 65%)` }}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={cn('flex shrink-0 items-center justify-center rounded-md', compact ? 'h-8 w-8' : 'h-9 w-9')}
          style={{ background: style.iconBg, color: style.accent }}
        >
          <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: style.accent }}>
              {style.label}
            </span>
          </div>
          <h3 className={cn('mt-1 font-semibold leading-snug text-fg', compact ? 'text-[13px]' : 'text-sm')}>
            {insight.headline}
          </h3>
          {insight.body && !compact && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{insight.body}</p>
          )}
          {insight.cta_label && insight.cta_href && (
            <Link
              href={insight.cta_href}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-all hover:gap-2.5"
              style={{ color: style.accent }}
            >
              {insight.cta_label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          <ConfidenceRing score={insight.score} color={style.ring} />
          {onDismiss && (
            <button
              type="button"
              onClick={() => start(() => onDismiss(insight.id))}
              disabled={pending}
              aria-label="Dismiss"
              className="rounded-md p-1 text-fg-dim transition hover:bg-white/5 hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PresenceCards({
  insights,
  onDismiss,
  variant = 'solid',
  emptyHint = 'Flux is observing your workspace. Insights appear here as you create.',
}: {
  insights: InsightCard[];
  onDismiss?: (id: string) => void;
  variant?: 'solid' | 'glass' | 'compact';
  emptyHint?: string;
}) {
  if (!insights.length) {
    return (
      <div className="rounded-lg border border-edge-subtle bg-surface-1 p-5 text-center">
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-flux-violet/15">
          <Sparkles className="h-4 w-4 text-flux-violet-bright animate-breathe" />
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">{emptyHint}</p>
      </div>
    );
  }
  return (
    <div className={cn(variant === 'compact' ? 'space-y-2' : 'space-y-2.5')}>
      {insights.map((i, idx) => (
        <PresenceCard key={i.id} insight={i} onDismiss={onDismiss} variant={variant} index={idx} />
      ))}
    </div>
  );
}
