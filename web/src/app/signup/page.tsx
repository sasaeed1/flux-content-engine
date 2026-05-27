import Link from 'next/link';
import { ArrowRight, Check, ExternalLink, Sparkles } from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { Badge } from '@/components/ui/badge';
import { AuthEmailForm } from '@/components/auth/auth-email-form';

export const metadata = { title: 'Get started · Flux' };

const PROOF = [
  '5 carousels / month on Free',
  'No credit card required',
  'Cancel any time',
  'Brand voice + 9 themes built-in',
];

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  return <SignupInner searchParams={searchParams} />;
}

async function SignupInner({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  const plan = (params.plan ?? 'free').toLowerCase();
  const wappflowUrl = process.env.NEXT_PUBLIC_WAPPFLOW_URL ?? 'https://wappflow.remoteops.co';

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <p className="text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100dvh-80px)] max-w-6xl items-center gap-12 px-6 pb-16 lg:grid-cols-2">
        {/* Left: pitch */}
        <div className="space-y-6">
          <Badge variant="accent" className="self-start">
            <Sparkles className="h-3 w-3" />
            {plan === 'free' ? 'Free forever' : `${cap(plan)} plan`}
          </Badge>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Start posting like a brand that{' '}
            <span className="gradient-text">actually shows up.</span>
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Pick a topic. Flux researches it, writes the slides, designs them
            on-brand, and queues them to publish. No designer required.
          </p>
          <ul className="space-y-2.5">
            {PROOF.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-3 w-3 text-emerald-400" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Compare plans <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Right: form */}
        <div className="rounded-3xl border border-border/60 bg-card/60 p-7 backdrop-blur-xl">
          <h2 className="text-lg font-semibold">Create your workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Takes 30 seconds. You can rename anything later.
          </p>

          <div className="mt-6 space-y-3">
            {/* WappFlow SSO */}
            <a
              href={`${wappflowUrl}/signup`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-violet-500/15 via-cyan-500/10 to-pink-500/15 p-3.5 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-flux-gradient text-background">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">Sign up via WappFlow</div>
                  <div className="text-xs text-muted-foreground">
                    Includes Flux on Growth+ plans
                  </div>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>

            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm font-medium text-muted-foreground"
            >
              Continue with Google
              <Badge variant="outline" className="ml-1">
                Coming soon
              </Badge>
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Or sign up with email
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <AuthEmailForm mode="signup" plan={plan} />
        </div>
      </section>
    </main>
  );
}

function cap(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}
