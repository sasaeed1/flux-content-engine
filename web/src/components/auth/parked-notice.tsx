import Link from 'next/link';
import { ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Shown on /login and /signup while Flux is parked. The marketing landing
 * page stays live; only the actual sign-in / sign-up flows are paused.
 */
export function ParkedNotice({ mode }: { mode: 'login' | 'signup' }) {
  const wappflowUrl =
    process.env.NEXT_PUBLIC_WAPPFLOW_URL ?? 'https://wappflow.remoteops.co';

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100dvh-80px)] max-w-md flex-col justify-center px-6 pb-16">
        <Badge variant="accent" className="self-start">
          <Clock className="h-3 w-3" /> Coming soon
        </Badge>

        <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          {mode === 'signup' ? (
            <>
              Flux sign-ups are <span className="gradient-text">paused</span>.
            </>
          ) : (
            <>
              Flux sign-in is <span className="gradient-text">paused</span>.
            </>
          )}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          We&apos;re putting the finishing touches on Flux. New{' '}
          {mode === 'signup' ? 'sign-ups' : 'sign-ins'} are temporarily closed —
          we&apos;ll be back shortly. Thanks for your patience.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="primary">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={wappflowUrl} target="_blank" rel="noopener noreferrer">
              Visit WappFlow <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
