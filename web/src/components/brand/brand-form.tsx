'use client';

import { useState, useTransition } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { updateBrandAction } from '@/app/(app)/brand/actions';
import type { BrandProfile, ThemePreset } from '@/lib/types';

interface Props {
  brand: BrandProfile;
  themes: ThemePreset[];
}

export function BrandForm({ brand, themes }: Props) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [form, setForm] = useState({
    name: brand.name,
    niche: brand.niche ?? '',
    businessType: brand.businessType ?? '',
    tone: brand.tone ?? '',
    ctaStyle: brand.ctaStyle ?? '',
    postStyle: brand.postStyle ?? '',
    voiceKeywords: brand.voiceKeywords.join(', '),
    voiceAvoid: brand.voiceAvoid.join(', '),
    themePresetKey: brand.theme.presetKey ?? '',
  });

  const save = () =>
    start(async () => {
      setStatus(null);
      try {
        await updateBrandAction(brand.id, {
          name: form.name.trim(),
          niche: form.niche.trim() || null,
          businessType: form.businessType.trim() || null,
          tone: form.tone.trim() || null,
          ctaStyle: form.ctaStyle.trim() || null,
          postStyle: form.postStyle.trim() || null,
          voiceKeywords: form.voiceKeywords
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          voiceAvoid: form.voiceAvoid
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          themePresetKey: form.themePresetKey.trim() || null,
        });
        setStatus({ kind: 'ok', msg: 'Brand updated.' });
      } catch (err) {
        setStatus({
          kind: 'err',
          msg: err instanceof Error ? err.message : 'Failed to update brand.',
        });
      }
    });

  const colors = brand.theme.colors;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left — form */}
      <div className="space-y-6 lg:col-span-2">
        <Section title="Identity">
          <Field label="Brand name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Niche">
            <Input
              placeholder="e.g. Personal finance for millennials"
              value={form.niche}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
            />
          </Field>
          <Field label="Business type">
            <Input
              placeholder="e.g. SaaS, creator, e-commerce"
              value={form.businessType}
              onChange={(e) =>
                setForm((f) => ({ ...f, businessType: e.target.value }))
              }
            />
          </Field>
        </Section>

        <Section title="Voice">
          <Field label="Tone">
            <Input
              placeholder="e.g. confident, warm, evidence-based"
              value={form.tone}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
            />
          </Field>
          <Field label="Post style">
            <Input
              placeholder="e.g. punchy hooks, short paragraphs, no fluff"
              value={form.postStyle}
              onChange={(e) =>
                setForm((f) => ({ ...f, postStyle: e.target.value }))
              }
            />
          </Field>
          <Field label="CTA style">
            <Input
              placeholder="e.g. soft, conversational, one ask per post"
              value={form.ctaStyle}
              onChange={(e) =>
                setForm((f) => ({ ...f, ctaStyle: e.target.value }))
              }
            />
          </Field>
          <Field label="Voice keywords" hint="Comma-separated. Words you love using.">
            <Textarea
              rows={2}
              value={form.voiceKeywords}
              onChange={(e) =>
                setForm((f) => ({ ...f, voiceKeywords: e.target.value }))
              }
            />
          </Field>
          <Field label="Voice to avoid" hint="Comma-separated. Words you never use.">
            <Textarea
              rows={2}
              value={form.voiceAvoid}
              onChange={(e) =>
                setForm((f) => ({ ...f, voiceAvoid: e.target.value }))
              }
            />
          </Field>
        </Section>

        <Section title="Theme preset">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themes.map((t) => {
              const active = form.themePresetKey === t.key;
              return (
                <button
                  type="button"
                  key={t.key}
                  onClick={() =>
                    setForm((f) => ({ ...f, themePresetKey: t.key }))
                  }
                  className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-primary/60 ring-flux'
                      : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div
                    className="h-12 w-full rounded-md"
                    style={{
                      background: `linear-gradient(135deg, ${t.colors.primary ?? '#22D3EE'}, ${
                        t.colors.accent ?? '#A78BFA'
                      }, ${t.colors.background ?? '#08090C'})`,
                    }}
                  />
                  <div className="mt-2.5 text-sm font-medium">{t.name}</div>
                  <div className="line-clamp-2 text-[11px] text-muted-foreground">
                    {t.description ?? t.visual_tone}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {status?.kind === 'ok' && (
              <span className="text-emerald-300">✓ {status.msg}</span>
            )}
            {status?.kind === 'err' && (
              <span className="text-red-300">{status.msg}</span>
            )}
          </div>
          <Button onClick={save} disabled={pending} variant="primary">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      </div>

      {/* Right — live preview */}
      <aside className="space-y-4">
        <div className="rounded-2xl glass p-5">
          <Label>Preview</Label>
          <div
            className="mt-3 aspect-square w-full overflow-hidden rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${colors.background ?? '#0F0F12'} 0%, ${
                colors.primary ?? '#22D3EE'
              }20 100%)`,
              border: `1px solid ${colors.accent ?? '#A78BFA'}40`,
            }}
          >
            <div className="flex h-full flex-col justify-between p-5">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.16em]"
                style={{ color: colors.accent ?? '#A78BFA' }}
              >
                {form.niche || 'Your niche here'}
              </div>
              <div>
                <div
                  className="text-2xl font-semibold leading-tight"
                  style={{ color: colors.foreground ?? '#FAFAFA' }}
                >
                  {form.name || 'Your brand'}
                </div>
                <div
                  className="mt-2 text-xs"
                  style={{ color: `${colors.foreground ?? '#FAFAFA'}99` }}
                >
                  {form.tone || 'Tone, voice, & vibe.'}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {form.voiceKeywords
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 6)
              .map((kw) => (
                <Badge key={kw} variant="accent">
                  {kw}
                </Badge>
              ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl glass p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
