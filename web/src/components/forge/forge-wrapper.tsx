'use client';

/**
 * ForgeWrapper — owns the Forge's cross-component state and the ignite flow.
 *
 * Layout: a full-bleed chamber (scrolls) above a bottom-docked CreationBar
 * (only shown while idle — during generation the chamber takes the stage and
 * a "Forge another" reset brings the bar back). Seeds the typed topic, then
 * drives the existing SSE stream. NO auto-redirect on completion — you stay in
 * the chamber to sculpt.
 */
import { useMemo, useState } from 'react';
import type { StyleMode } from '@/components/flux/style-tile';
import { usePipelineStream } from '@/lib/use-pipeline-stream';
import { seedForgeTopicAction } from '@/app/(app)/forge/actions';
import { ForgeChamber } from './forge-chamber';
import { CreationBar } from './creation-bar';
import { VariationsBar } from './variations-bar';
import { DraftEditor } from './draft-editor';

function recommendStyle(topic: string, styles: StyleMode[]): string | null {
  const t = topic.toLowerCase();
  const has = (k: string) => styles.find((s) => s.key === k)?.key ?? null;
  if (/money|wealth|finance|invest|rich|profit|sales/.test(t))
    return has('wealth-aesthetic') ?? has('finance-bro-premium') ?? styles[0]?.key ?? null;
  if (/\bai\b|tech|software|saas|code|startup|automation/.test(t))
    return has('futuristic-ai') ?? has('saas-dashboard') ?? styles[0]?.key ?? null;
  if (/luxury|premium|elegant|high-end|exclusive/.test(t))
    return has('luxury-black') ?? styles[0]?.key ?? null;
  if (/health|fitness|sport|gym|train|athlete/.test(t))
    return has('sports-performance') ?? styles[0]?.key ?? null;
  if (/learn|guide|how to|tips|educat|tutorial|steps/.test(t))
    return has('clean-educational') ?? styles[0]?.key ?? null;
  return styles[0]?.key ?? null;
}

export function ForgeWrapper({
  styles,
  initialSeed,
  sparks,
}: {
  styles: StyleMode[];
  initialSeed: string;
  sparks: string[];
}) {
  const [topic, setTopic] = useState(initialSeed);
  const [selectedKey, setSelectedKey] = useState<string | null>(styles[0]?.key ?? null);
  const [draftFirst, setDraftFirst] = useState(false);
  const { state, start, reset } = usePipelineStream();

  const busy = state.status === 'connecting' || state.status === 'running';
  const idle = state.status === 'idle';

  const recommendedKey = useMemo(
    () => (topic.trim().length >= 8 ? recommendStyle(topic, styles) : null),
    [topic, styles],
  );

  const selectedStyle = styles.find((s) => s.key === selectedKey) ?? null;

  // Resolve hook / cta slide indices from the streamed content for the
  // sculpt actions in the settled footer.
  const hookIndex =
    state.content?.slides?.find((s) => s.role === 'hook')?.index ?? 0;
  const ctaIndex =
    state.content?.slides?.find((s) => s.role === 'cta')?.index ?? null;

  const onIgnite = () => {
    if (!topic.trim() || busy) return;
    void (async () => {
      const seed = await seedForgeTopicAction(topic.trim());
      await start({
        topic: topic.trim(),
        topicId: seed.topicId ?? undefined,
        brandProfileId: seed.brandProfileId ?? undefined,
        styleModeKey: selectedKey ?? undefined,
        approvalMode: 'manual',
        draftOnly: draftFirst,
      });
    })();
  };

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      {/* Chamber */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-edge-subtle bg-surface-0/40 scroll-hide">
        <ForgeChamber
          state={state}
          selectedStyle={selectedStyle}
          topic={topic}
          recommended={!!recommendedKey && recommendedKey === selectedKey}
          onReset={reset}
          footerSlot={
            state.isDraft && state.carouselId ? (
              <DraftEditor
                carouselId={state.carouselId}
                slides={(state.content?.slides ?? []) as Parameters<typeof DraftEditor>[0]['slides']}
              />
            ) : state.carouselId ? (
              <VariationsBar
                carouselId={state.carouselId}
                hookIndex={hookIndex}
                ctaIndex={ctaIndex}
                styles={styles}
              />
            ) : null
          }
        />
      </div>

      {/* Creation bar — docked, only while idle */}
      {idle && (
        <CreationBar
          topic={topic}
          setTopic={setTopic}
          styles={styles}
          selectedKey={selectedKey}
          setSelectedKey={setSelectedKey}
          recommendedKey={recommendedKey}
          sparks={sparks}
          busy={busy}
          onIgnite={onIgnite}
          draftFirst={draftFirst}
          setDraftFirst={setDraftFirst}
        />
      )}
    </div>
  );
}
