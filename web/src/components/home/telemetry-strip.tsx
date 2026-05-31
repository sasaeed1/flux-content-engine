'use client';

/**
 * TelemetryStrip — the stats, demoted from hero to ambient context.
 *
 * A single slim row: Pending · Ready · Scheduled · Published. Each value
 * count-rolls up on mount (values feel computed, not set) and links into the
 * Library filtered to that state. No more four big cards stealing the home.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function useCountUp(target: number, durationMs = 700): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs]);
  return val;
}

interface Metric {
  label: string;
  value: number;
  href: string;
  color: string;
}

function Cell({ metric, last }: { metric: Metric; last: boolean }) {
  const v = useCountUp(metric.value);
  return (
    <Link
      href={metric.href}
      className={cn(
        'press group flex flex-1 items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-1',
        !last && 'border-r border-edge-subtle',
      )}
    >
      <div>
        <div className="text-label text-fg-dim">{metric.label}</div>
        <div className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
          {v.toLocaleString()}
        </div>
      </div>
      <span
        className="h-8 w-1 rounded-full opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: metric.color, boxShadow: `0 0 12px ${metric.color}` }}
      />
    </Link>
  );
}

export function TelemetryStrip({
  pending,
  ready,
  scheduled,
  published,
}: {
  pending: number;
  ready: number;
  scheduled: number;
  published: number;
}) {
  const metrics: Metric[] = [
    { label: 'Pending', value: pending, href: '/library?status=pending', color: '#A78BFA' },
    { label: 'Ready', value: ready, href: '/library?status=ready', color: '#22D3EE' },
    { label: 'Scheduled', value: scheduled, href: '/library?status=scheduled', color: '#EC4899' },
    { label: 'Published', value: published, href: '/library?status=published', color: '#34D399' },
  ];
  return (
    <div className="flex overflow-hidden rounded-xl border border-edge-subtle bg-surface-0">
      {metrics.map((m, i) => (
        <Cell key={m.label} metric={m} last={i === metrics.length - 1} />
      ))}
    </div>
  );
}
