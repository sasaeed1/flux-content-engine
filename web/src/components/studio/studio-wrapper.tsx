'use client';

/**
 * Studio wrapper — owns the cross-column state (selected style, current
 * topic). Children (canvas + browser + assistant) read+write through here.
 */
import { useState } from 'react';
import { StudioCanvas } from './studio-canvas';
import { StyleBrowser } from './style-browser';
import { StudioAssistant } from './studio-assistant';
import type { StyleMode } from '@/components/flux/style-tile';
import type { InsightCard } from '@/components/flux/presence-card';

export function StudioWrapper({
  styles,
  insights,
  carousels,
}: {
  styles: StyleMode[];
  insights: InsightCard[];
  carousels: Array<{
    id: string;
    title: string | null;
    hook: string | null;
    status: string;
    slide_count: number;
    slides?: Array<{ imageUrl?: string; role?: string }>;
    created_at: string;
  }>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [topic] = useState('');

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* Left: style browser */}
      <aside className="order-2 max-h-[600px] rounded-2xl border border-border/40 bg-card/30 p-3 xl:order-1 xl:max-h-[80vh]">
        <StyleBrowser
          modes={styles}
          activeKey={selectedKey}
          onSelect={setSelectedKey}
        />
      </aside>

      {/* Center: canvas */}
      <section className="order-1 min-h-[420px] xl:order-2 xl:min-h-[80vh]">
        <StudioCanvas
          defaultTopic={topic}
          selectedThemeKey={selectedKey}
          recent={carousels}
        />
      </section>

      {/* Right: assistant */}
      <aside className="order-3 rounded-2xl border border-border/40 bg-card/30 p-4 xl:max-h-[80vh] xl:overflow-y-auto">
        <StudioAssistant initialInsights={insights} defaultTopic={topic} />
      </aside>
    </div>
  );
}
