'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plug,
  PlugZap,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  connectInstagramAction,
  disconnectInstagramAction,
} from '@/app/(app)/settings/actions';
import type { InstagramAccount } from '@/lib/types';

export function InstagramConnect({ accounts }: { accounts: InstagramAccount[] }) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(accounts.length === 0);
  const [igId, setIgId] = useState('');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!igId.trim() || !token.trim()) {
      setErr('Both the IG business account ID and access token are required.');
      return;
    }
    start(async () => {
      try {
        await connectInstagramAction({
          igBusinessAccountId: igId.trim(),
          accessToken: token.trim(),
          username: username.trim() || undefined,
          makeDefault: accounts.length === 0,
        });
        setOk('Connected. Flux will now publish to this account once approved.');
        setIgId('');
        setToken('');
        setUsername('');
        setShowForm(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to connect.');
      }
    });
  };

  const disconnect = (id: string) => {
    if (!confirm('Disconnect this Instagram account? Scheduled posts will stop.')) return;
    setErr(null);
    setOk(null);
    start(async () => {
      try {
        await disconnectInstagramAction(id);
        setOk('Account disconnected.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to disconnect.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Account list */}
      {accounts.length > 0 && (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-4 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-flux-gradient text-sm font-semibold">
                {(a.username ?? 'IG').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    @{a.username ?? 'instagram'}
                  </span>
                  {a.is_default && <Badge variant="accent">Default</Badge>}
                  {!a.active && <Badge variant="outline">Inactive</Badge>}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  ID: {a.ig_business_account_id.slice(0, 10)}…
                  {a.followers_count ? ` · ${a.followers_count.toLocaleString()} followers` : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect(a.id)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Toggle */}
      {!showForm && (
        <Button
          variant="outline"
          onClick={() => {
            setShowForm(true);
            setOk(null);
            setErr(null);
          }}
        >
          <Plug className="h-4 w-4" /> Connect another account
        </Button>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-border/50 bg-secondary/20 p-5"
        >
          <div className="flex items-start gap-3">
            <PlugZap className="mt-1 h-4 w-4 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Connect Instagram Business</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                You&apos;ll need a Meta Graph API long-lived access token and your
                Instagram Business Account ID.{' '}
                <a
                  href="/help#instagram"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  How do I get these?
                </a>
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ig-id">IG Business Account ID *</Label>
              <Input
                id="ig-id"
                placeholder="17841401234567890"
                value={igId}
                onChange={(e) => setIgId(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-username">Username (optional)</Label>
              <Input
                id="ig-username"
                placeholder="your.handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ig-token">Long-lived access token *</Label>
            <Input
              id="ig-token"
              type="password"
              placeholder="EAA…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={pending}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-muted-foreground">
              Stored encrypted at rest. Never echoed back to the browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              Connect
            </Button>
            {accounts.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setErr(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {ok && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-100">
          <CheckCircle2 className="h-4 w-4" /> {ok}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" /> {err}
        </div>
      )}
    </div>
  );
}
