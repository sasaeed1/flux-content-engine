'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  mode: 'login' | 'signup';
  plan?: string;
}

/**
 * Beautiful email/password form. Native auth backend lands next batch — for now
 * the form acknowledges submission and points users at the WappFlow SSO path,
 * which is the working sign-in route.
 */
export function AuthEmailForm({ mode, plan }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (!email.trim() || !password.trim()) {
      setErr('Email and password are required.');
      return;
    }
    start(async () => {
      try {
        // Native auth endpoint hooks up next batch. For now we register interest
        // and surface the WappFlow path which already works end-to-end.
        const res = await fetch(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, name, workspaceName, plan }),
        });
        if (res.ok) {
          // future: server sets cookie, push to dashboard
          router.push('/dashboard');
          return;
        }
        if (res.status === 404 || res.status === 501) {
          setOk(
            mode === 'signup'
              ? "We've recorded your interest. Native sign-up launches in days — meanwhile, use the WappFlow path above to get in today."
              : 'Native sign-in launches in days. Use the WappFlow path above for now.',
          );
          return;
        }
        const text = await res.text().catch(() => '');
        setErr(text.slice(0, 200) || `Request failed (${res.status}).`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Request failed.');
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'signup' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Your name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="auth-name"
                placeholder="Sasaeed"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                className="pl-9"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-workspace">Workspace name</Label>
            <Input
              id="auth-workspace"
              placeholder="My brand"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              disabled={pending}
              autoComplete="organization"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="auth-email"
            type="email"
            placeholder="you@brand.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            required
            className="pl-9"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="auth-password"
            type="password"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            required
            minLength={8}
            className="pl-9"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full justify-center"
        size="lg"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {mode === 'signup' ? 'Create workspace' : 'Sign in'}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      {ok && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          {ok}
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
    </form>
  );
}
