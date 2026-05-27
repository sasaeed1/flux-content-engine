import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  Images,
  Palette,
  Send,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { GradientText } from '@/components/flux/gradient-text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Wand2,
    title: 'Topic → Carousel in minutes',
    body: 'Pick a topic. Flux researches it, writes the slides, designs them, and queues them to publish.',
  },
  {
    icon: Brain,
    title: 'On-brand by default',
    body: 'Your voice, colors, fonts, hashtags — applied to every post. No drift, no rewrites.',
  },
  {
    icon: Send,
    title: 'Approve, schedule, ship',
    body: 'Review carousels in your library. Approve and Flux schedules to Instagram automatically.',
  },
];

const howItWorks = [
  {
    icon: Sparkles,
    title: 'Pick (or generate) a topic',
    body: 'Type one or let Flux suggest grounded in your niche, brand voice, and recent posts.',
  },
  {
    icon: Brain,
    title: 'AI writes your script',
    body: 'Hook, body slides, CTA — all in your tone, with your keywords, avoiding your no-go words.',
  },
  {
    icon: Palette,
    title: 'Slides render on-brand',
    body: 'Server-side HTML + Chromium produces pixel-perfect PNGs in seconds. Nine themes built-in.',
  },
  {
    icon: Calendar,
    title: 'Review, approve, schedule',
    body: 'Approve from the library. Optional publish-at time. Flux handles the IG Graph API for you.',
  },
];

const tiers: Array<{
  key: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  popular?: boolean;
  cta: string;
  ctaHref: string;
  features: string[];
}> = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Try the engine. Make real carousels.',
    cta: 'Start free',
    ctaHref: '/signup?plan=free',
    features: [
      '5 carousels / month',
      'Groq free-tier AI',
      'All 9 theme presets',
      'Manual approval workflow',
      '1 brand profile',
      '1 Instagram account',
      'Community support',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$9',
    cadence: '/month',
    description: 'For solo creators and SMBs posting regularly.',
    cta: 'Start free trial',
    ctaHref: '/signup?plan=starter',
    features: [
      '25 carousels / month',
      'Premium LLM (GPT-4o-mini / Claude Haiku)',
      'Auto-schedule to IG',
      '3 brand profiles',
      '2 Instagram accounts',
      'Email support',
      'Hashtag intelligence',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$20',
    cadence: '/month',
    description: 'For brands that post daily and want the works.',
    popular: true,
    cta: 'Start free trial',
    ctaHref: '/signup?plan=growth',
    features: [
      '100 carousels / month',
      'Premium LLM + AI image generation',
      'Auto-schedule + drip queues',
      'Unlimited brand profiles',
      '5 Instagram accounts',
      'Priority support',
      'Analytics feedback loop',
      'WappFlow integration',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    description: 'Agencies, multi-brand orgs, and high-volume teams.',
    cta: 'Talk to sales',
    ctaHref: 'mailto:hello@remoteops.co?subject=Flux%20Enterprise',
    features: [
      'Unlimited carousels',
      'Custom models (BYOK or hosted)',
      'Unlimited brand profiles',
      'Unlimited Instagram accounts',
      'White-label dashboard',
      'SSO, audit logs, role-based access',
      'Dedicated success manager',
      'SLA-backed support',
    ],
  },
];

const faqs = [
  {
    q: 'How is Flux different from ChatGPT or Canva?',
    a: 'ChatGPT writes text. Canva is a manual editor. Flux is an end-to-end engine — it researches, writes, designs, captions, and queues a publish-ready carousel from a single topic, in your brand voice.',
  },
  {
    q: 'Do I need an Instagram account to start?',
    a: 'No. On any tier you can produce and review carousels without connecting Instagram. You only need to connect IG when you want Flux to publish for you.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts on Starter or Growth. Cancel from Settings → Billing — you keep access until the end of the period.',
  },
  {
    q: 'Is this the same as WappFlow?',
    a: "No — Flux is its own product. But if you're already on WappFlow Growth or Enterprise, Flux is included free as part of your plan.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition hover:text-foreground">
            How it works
          </a>
          <a href="#pricing" className="transition hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
          <Link href="/help" className="transition hover:text-foreground">
            Help
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" variant="primary" asChild>
            <Link href="/signup">
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-6 pt-16 text-center sm:pt-24">
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
            'Flux turns one topic into a finished, on-brand Instagram carousel — researched, written, designed, captioned, and queued.'}{' '}
          One platform. Zero designers.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="primary" asChild>
            <Link href="/signup">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#pricing">See pricing</a>
          </Button>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          No credit card required · 5 carousels free / month
        </p>
      </section>

      {/* Feature row */}
      <section className="relative mx-auto mt-28 grid max-w-6xl gap-4 px-6 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="relative rounded-2xl glass p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
          >
            <f.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="relative mx-auto mt-32 max-w-6xl px-6">
        <div className="text-center">
          <Badge variant="outline">How it works</Badge>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            From topic to <GradientText>published</GradientText> in 4 steps.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            No drag-and-drop. No prompt engineering. Just topics in, posts out.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl glass p-6"
            >
              <div className="absolute right-5 top-5 text-3xl font-bold text-muted-foreground/30">
                0{i + 1}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-gradient">
                <step.icon className="h-5 w-5 text-background" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative mx-auto mt-32 max-w-7xl px-6">
        <div className="text-center">
          <Badge variant="outline">Pricing</Badge>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            No per-seat gotchas. No surprise bills. Free tier covers real usage —
            no demo trap.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {tiers.map((t) => (
            <article
              key={t.key}
              className={[
                'relative flex flex-col rounded-2xl p-6 transition-all',
                t.popular
                  ? 'border-2 border-primary/60 bg-gradient-to-b from-primary/10 to-card/80 shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]'
                  : 'glass hover:border-primary/30',
              ].join(' ')}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="accent" className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]">
                    Most popular
                  </Badge>
                </div>
              )}

              <div>
                <h3 className="text-xl font-semibold">{t.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-5xl font-bold tracking-tight">{t.price}</span>
                {t.cadence && (
                  <span className="text-sm text-muted-foreground">{t.cadence}</span>
                )}
              </div>

              <Button
                asChild
                variant={t.popular ? 'primary' : 'outline'}
                className="mt-6 w-full justify-center"
                size="lg"
              >
                <Link href={t.ctaHref}>
                  {t.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <ul className="mt-7 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2
                      className={[
                        'mt-0.5 h-4 w-4 shrink-0',
                        t.popular ? 'text-primary' : 'text-emerald-400',
                      ].join(' ')}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          All tiers include unlimited brand profile edits, theme switching, and dashboard access. Paid
          tier API integrations are rolling out throughout the quarter.
        </p>
      </section>

      {/* CTA strip */}
      <section className="relative mx-auto mt-32 max-w-5xl px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-violet-600/15 to-cyan-500/15 p-10 text-center backdrop-blur-xl">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.35),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.25),transparent_60%)]" />
          <Sparkles className="mx-auto h-7 w-7 text-primary" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop staring at a blank Canva.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            5 carousels free, every month. Connect Instagram when you&apos;re ready.
            Cancel any time.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="primary" asChild>
              <Link href="/signup">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://wappflow.remoteops.co" target="_blank" rel="noopener noreferrer">
                Already on WappFlow? <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto mt-32 max-w-3xl px-6">
        <div className="text-center">
          <Badge variant="outline">FAQ</Badge>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Common questions.
          </h2>
        </div>
        <div className="mt-10 divide-y divide-border/60 overflow-hidden rounded-2xl glass">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 transition open:bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="text-sm font-medium sm:text-base">{f.q}</span>
                <span className="ml-4 text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="relative mt-24 border-t border-border/40 px-6 py-8 text-xs text-muted-foreground sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="opacity-70">v0.2 — beta</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/help" className="hover:text-foreground">
              Help
            </Link>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <a
              href="https://wappflow.remoteops.co"
              className="hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              WappFlow
            </a>
            <span className="opacity-70">© {new Date().getFullYear()} Flux</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
