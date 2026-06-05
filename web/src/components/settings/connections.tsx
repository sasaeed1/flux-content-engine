'use client';

/**
 * Connections — multi-platform publishing channels (Instagram / LinkedIn /
 * TikTok). Each platform card shows connected accounts + a connect form built
 * from the platform's declared fields. Publishing routes through the engine's
 * publisher registry, so the moment a valid token is entered it works.
 */
import { useState, useTransition } from 'react';
import { AlertCircle, CheckCircle2, Link2, Loader2, Plug, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  connectChannelAction,
  disconnectChannelAction,
} from '@/app/(app)/settings/actions';
import type { PlatformDescriptor, SocialConnectionPublic } from '@/lib/types';

export function Connections({
  platforms,
  connections,
}: {
  platforms: PlatformDescriptor[];
  connections: SocialConnectionPublic[];
}) {
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {platforms.map((p) => (
        <PlatformCard
          key={p.platform}
          descriptor={p}
          accounts={connections.filter((c) => c.platform === p.platform)}
          open={openPlatform === p.platform}
          onToggle={() => setOpenPlatform((cur) => (cur === p.platform ? null : p.platform))}
        />
      ))}
    </div>
  );
}

function PlatformCard({
  descriptor,
  accounts,
  open,
  onToggle,
}: {
  descriptor: PlatformDescriptor;
  accounts: SocialConnectionPublic[];
  open: boolean;
  onToggle: () => void;
}) {
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const missing = descriptor.connectFields
      .filter((f) => f.required && !(fields[f.key] ?? '').trim())
      .map((f) => f.label);
    if (missing.length) {
      setErr(`Required: ${missing.join(', ')}`);
      return;
    }
    start(async () => {
      try {
        const res = await connectChannelAction(descriptor.platform, fields);
        setOk(`Connected ${res.connection.displayName ?? descriptor.name}.`);
        setFields({});
        onToggle();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to connect.');
      }
    });
  };

  const disconnect = (id: string) => {
    if (!confirm(`Disconnect this ${descriptor.name} account? Scheduled posts will stop.`)) return;
    setErr(null);
    setOk(null);
    start(async () => {
      try {
        await disconnectChannelAction(id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to disconnect.');
      }
    });
  };

  const supports = [
    descriptor.supports.carousel && 'Carousels',
    descriptor.supports.image && 'Images',
    descriptor.supports.video && 'Video',
  ].filter(Boolean) as string[];

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-secondary/20">
      <div className="flex items-center gap-3 p-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{ background: descriptor.accent }}
        >
          {descriptor.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{descriptor.name}</h3>
            {accounts.length > 0 ? (
              <Badge variant="success">{accounts.length} connected</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
            {!descriptor.appConfigured && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                API keys pending
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{descriptor.tagline}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            {supports.join(' · ')}
          </p>
        </div>
        <Button variant={open ? 'ghost' : 'outline'} size="sm" onClick={onToggle} disabled={pending}>
          {open ? 'Close' : (
            <>
              <Plug className="h-4 w-4" /> Connect
            </>
          )}
        </Button>
      </div>

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/40 px-4 py-3">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <Link2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="min-w-0 flex-1 truncate">
                {a.displayName ?? a.externalId ?? 'Account'}
                {a.isDefault && <span className="ml-1.5 text-[10px] text-muted-foreground">· default</span>}
              </span>
              {a.status !== 'connected' && <Badge variant="warning">{a.status}</Badge>}
              <Button variant="ghost" size="sm" onClick={() => disconnect(a.id)} disabled={pending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Connect form */}
      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-border/40 bg-background/30 p-4">
          {!descriptor.appConfigured && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
              One-click OAuth for {descriptor.name} activates once the app keys are added on the
              server. Until then, paste a token below — publishing works immediately.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {descriptor.connectFields.map((f) => (
              <div key={f.key} className={f.secret ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                <Label htmlFor={`${descriptor.platform}-${f.key}`}>
                  {f.label} {f.required && <span className="text-primary">*</span>}
                </Label>
                <Input
                  id={`${descriptor.platform}-${f.key}`}
                  type={f.secret ? 'password' : 'text'}
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  disabled={pending}
                  autoComplete="off"
                  spellCheck={false}
                />
                {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Connect {descriptor.name}
            </Button>
            {descriptor.docsHref && (
              <a
                href={descriptor.docsHref}
                target={descriptor.docsHref.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                How do I get these?
              </a>
            )}
          </div>
        </form>
      )}

      {ok && (
        <div className="flex items-center gap-2 border-t border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4" /> {ok}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" /> {err}
        </div>
      )}
    </div>
  );
}
