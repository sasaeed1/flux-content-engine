'use client';

/**
 * SystemSettings — org-level generation/motion/SEO/notification controls.
 * Persists to organizations.metadata.settings and drives real pipeline +
 * reel behaviour (default slide count, creativity, motion defaults, …).
 */
import { useState, useTransition } from 'react';
import { Check, Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateSettingsAction } from '@/app/(app)/settings/actions';
import type { FluxSettings } from '@/lib/types';

const PRESETS = ['still', 'subtle', 'dynamic', 'cinematic', 'kinetic'];

export function SystemSettings({ initial }: { initial: FluxSettings }) {
  const [s, setS] = useState<FluxSettings>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    start(async () => {
      setSaved(false);
      await updateSettingsAction(s as unknown as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });

  const g = s.generation;
  const m = s.motion;

  return (
    <section className="space-y-6 rounded-2xl glass p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">System settings</h2>
          <p className="text-sm text-muted-foreground">
            Defaults that shape every generation. Saved per workspace.
          </p>
        </div>
      </header>

      <Group title="Generation">
        <Row label="Default slides">
          <select
            value={g.defaultSlideCount ?? 'auto'}
            onChange={(e) =>
              setS((p) => ({
                ...p,
                generation: {
                  ...p.generation,
                  defaultSlideCount: e.target.value === 'auto' ? null : Number(e.target.value),
                },
              }))
            }
            className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm"
          >
            <option value="auto">Auto (template)</option>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Row>
        <Slider
          label="Creativity"
          left="Precise"
          right="Wild"
          value={g.creativity}
          onChange={(v) => setS((p) => ({ ...p, generation: { ...p.generation, creativity: v } }))}
        />
        <Slider
          label="Hashtags"
          left="3"
          right="30"
          min={3}
          max={30}
          value={g.hashtagCount}
          display={String(g.hashtagCount)}
          onChange={(v) =>
            setS((p) => ({ ...p, generation: { ...p.generation, hashtagCount: Math.round(v) } }))
          }
        />
      </Group>

      <Group title="Motion (reels)">
        <Row label="Default aspect">
          <Segmented
            options={['reel', 'square', 'portrait']}
            value={m.defaultAspect}
            onChange={(v) =>
              setS((p) => ({ ...p, motion: { ...p.motion, defaultAspect: v as FluxSettings['motion']['defaultAspect'] } }))
            }
          />
        </Row>
        <Row label="Default motion">
          <select
            value={m.defaultPreset}
            onChange={(e) => setS((p) => ({ ...p, motion: { ...p.motion, defaultPreset: e.target.value } }))}
            className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-1.5 text-sm capitalize"
          >
            {PRESETS.map((pr) => (
              <option key={pr} value={pr}>
                {pr}
              </option>
            ))}
          </select>
        </Row>
        <Toggle
          label="Kinetic hook intro by default"
          checked={m.kineticByDefault}
          onChange={(v) => setS((p) => ({ ...p, motion: { ...p.motion, kineticByDefault: v } }))}
        />
      </Group>

      <Group title="Intelligence & alerts">
        <Toggle
          label="SEO-optimize topic generation"
          checked={s.seo.optimize}
          onChange={(v) => setS((p) => ({ ...p, seo: { optimize: v } }))}
        />
        <Toggle
          label="Notify on publish"
          checked={s.notifications.onPublish}
          onChange={(v) => setS((p) => ({ ...p, notifications: { ...p.notifications, onPublish: v } }))}
        />
        <Toggle
          label="Notify on failure"
          checked={s.notifications.onFailure}
          onChange={(v) => setS((p) => ({ ...p, notifications: { ...p.notifications, onFailure: v } }))}
        />
      </Group>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <Button onClick={save} disabled={pending} variant="primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      <div className="space-y-3 rounded-xl border border-border/40 bg-secondary/20 p-4">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Slider({
  label,
  left,
  right,
  value,
  onChange,
  min = 0,
  max = 1,
  display,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  display?: string;
}) {
  const pct = max > 1 ? value : Math.round(value * 100);
  const step = max > 1 ? 1 : 1;
  const sliderMax = max > 1 ? max : 100;
  const sliderVal = max > 1 ? value : Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] text-muted-foreground">{display ?? pct}</span>
      </div>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={sliderVal}
        onChange={(e) => onChange(max > 1 ? Number(e.target.value) : Number(e.target.value) / 100)}
        className="w-full accent-primary"
      />
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md border px-2.5 py-1 text-xs capitalize transition ${
            value === o
              ? 'border-primary/50 bg-primary/15 text-primary'
              : 'border-border/60 text-muted-foreground hover:text-foreground'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? 'bg-primary' : 'border border-border/60 bg-secondary/40'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
