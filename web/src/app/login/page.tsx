import Link from 'next/link';
import { ArrowRight, ExternalLink, Lock, Mail, Sparkles } from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { Badge } from '@/components/ui/badge';
import { AuthEmailForm } from '@/components/auth/auth-email-form';
import { ParkedNotice } from '@/components/auth/parked-notice';
import { FLUX_PARKED } from '@/lib/parked';

export const metadata = { title: 'Sign in · Flux' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  if (FLUX_PARKED) return <ParkedNotice mode="login" />;
  return <LoginInner searchParams={searchParams} />;
}

async function LoginInner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const params = await searchParams;
  const wappflowUrl = process.env.NEXT_PUBLIC_WAPPFLOW_URL ?? 'https://wappflow.remoteops.co';

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <p className="text-xs text-muted-foreground">
          New here?{' '}
          <Link href="/signup" className="text-primary hover:underline">
            Create a workspace
          </Link>
        </p>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100dvh-80px)] max-w-md flex-col justify-center px-6 pb-16">
        <Badge variant="accent" className="self-start">
          <Sparkles className="h-3 w-3" /> Welcome back
        </Badge>

        <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Sign in to <span className="gradient-text">Flux</span>.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Pick up your library where you left it.
        </p>

        {params.error && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorCopy(params.error)}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {/* Primary: WappFlow SSO */}
          <a
            href={`${wappflowUrl}/dashboard`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-violet-500/15 via-cyan-500/10 to-pink-500/15 p-4 transition hover:border-primary/50 hover:from-violet-500/25 hover:via-cyan-500/20 hover:to-pink-500/25"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-flux-gradient text-background">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold">Continue from WappFlow</div>
                <div className="text-xs text-muted-foreground">
                  Recommended · auto-sign-in if you&apos;re on Growth+
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-0.5" />
          </a>

          {/* Google (placeholder) */}
          <button
            type="button"
            disabled
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3.5 text-sm font-medium text-muted-foreground transition disabled:cursor-not-allowed"
          >
            <GoogleGlyph />
            Continue with Google
            <Badge variant="outline" className="ml-1">Coming soon</Badge>
          </button>
        </div>

        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Or with email
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>

        <AuthEmailForm mode="login" />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in you agree to our{' '}
          <Link href="/help" className="underline-offset-2 hover:underline">
            terms
          </Link>{' '}
          &amp;{' '}
          <Link href="/help" className="underline-offset-2 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case 'sso_failed':
      return 'Sign-in via WappFlow failed. The link may have expired — try again.';
    case 'sso_error':
      return 'Network issue contacting the Flux engine. Please retry in a moment.';
    case 'missing_token':
      return 'No sign-in token was provided. Sign in from WappFlow or use email below.';
    default:
      return 'Sign-in didn’t complete. Try again or use a different method.';
  }
}

function GoogleGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M15.68 8.182a8.59 8.59 0 0 0-.137-1.546H8v2.923h4.31a3.68 3.68 0 0 1-1.6 2.414v2.005h2.587c1.514-1.395 2.383-3.45 2.383-5.796z"
        fill="#4285F4"
      />
      <path
        d="M8 16c2.16 0 3.97-.717 5.297-1.942l-2.587-2.005c-.717.48-1.633.764-2.71.764-2.084 0-3.85-1.408-4.482-3.302H.84v2.072A8 8 0 0 0 8 16z"
        fill="#34A853"
      />
      <path
        d="M3.518 9.515A4.8 4.8 0 0 1 3.27 8c0-.527.091-1.036.247-1.515V4.413H.84A8 8 0 0 0 0 8c0 1.29.31 2.512.84 3.587l2.678-2.072z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.182c1.175 0 2.231.404 3.06 1.198l2.297-2.297C11.967.794 10.156 0 8 0A8 8 0 0 0 .84 4.413l2.678 2.072C4.149 4.59 5.916 3.182 8 3.182z"
        fill="#EA4335"
      />
    </svg>
  );
}
