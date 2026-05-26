import Link from 'next/link';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { GradientText } from '@/components/flux/gradient-text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    title: 'Topic → Carousel in minutes',
    body: 'Pick a topic. Flux researches it, writes the slides, designs them, and queues them to publish.',
  },
  {
    title: 'On-brand by default',
    body: 'Your voice, colors, fonts, hashtags — applied to every post. No drift, no rewrites.',
  },
  {
    title: 'Approve, schedule, ship',
    body: 'Review carousels in your library. Approve and Flux schedules to Instagram automatically.',
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button size="sm" variant="primary" asChild>
            <Link href="/dashboard">
              Open dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-6 pt-20 text-center sm:pt-28">
        <Badge variant="accent" className="mx-auto">
          <Sparkles className="h-3 w-3" /> New · multi-tenant content engine
        </Badge>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          AI Instagram content,
          <br />
          <GradientText>on autopilot.</GradientText>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {process.env.NEXT_PUBLIC_FLUX_TAGLINE ??
            'Flux turns one topic into a finished, on-brand Instagram carousel — ready to schedule.'}{' '}
          Bring your brand. We handle the rest.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Button size="lg" variant="primary" asChild>
            <Link href="/dashboard">
              Launch Flux
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/library">View library</Link>
          </Button>
        </div>
      </section>

      {/* Feature row */}
      <section className="relative mx-auto mt-28 grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="relative rounded-2xl glass p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
          >
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="relative border-t border-border/40 px-6 py-6 text-xs text-muted-foreground sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>© {new Date().getFullYear()} Flux</span>
          <span className="opacity-70">v0.1 — preview build</span>
        </div>
      </footer>
    </main>
  );
}
