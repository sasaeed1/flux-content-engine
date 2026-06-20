import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Film,
  Layers,
  Palette,
  Pencil,
  RefreshCw,
  Shuffle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { AuroraBackground } from '@/components/flux/aurora-bg';
import { Logo } from '@/components/flux/logo';
import { GradientText } from '@/components/flux/gradient-text';
import { Reveal, Counter } from '@/components/flux/reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FLUX_PARKED } from '@/lib/parked';
import type { ReactNode } from 'react';

/**
 * Sign-in / sign-up CTA. While Flux is parked it renders disabled with a
 * "Coming soon" tag instead of linking to /login or /signup.
 */
function AuthCta({
  href,
  children,
  variant = 'primary',
  size = 'lg',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'lg' | 'default';
  className?: string;
}) {
  if (FLUX_PARKED) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        {children}
        <Badge variant="outline" className="ml-1.5 normal-case tracking-normal">
          Coming soon
        </Badge>
      </Button>
    );
  }
  return (
    <Button variant={variant} size={size} asChild className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

// Three SMB-anchored value props — leans into operational leverage, not AI jargon.
const features = [
  {
    icon: ShieldCheck,
    title: 'On-brand. Every single post.',
    body: 'Your colors, fonts, tone, hashtags — locked in once. Flux holds the line so your feed actually looks like one brand.',
  },
  {
    icon: Zap,
    title: 'Post daily without hiring a designer.',
    body: 'One topic in. Finished carousel out — captions, hashtags, slides, scheduling. The whole content desk in 60 seconds.',
  },
  {
    icon: Users,
    title: 'You approve. Flux ships.',
    body: 'Edit a caption, rewrite a hook, swap a slide — then approve. Nothing publishes until you say it does.',
  },
];

const howItWorks = [
  {
    icon: Sparkles,
    title: 'Drop a topic',
    body: 'Type one or have Flux generate a fresh batch grounded in your brand and recent posts.',
  },
  {
    icon: Brain,
    title: 'Flux writes the script',
    body: 'Hook, body slides, CTA — in your voice, with your keywords, avoiding your no-go phrases.',
  },
  {
    icon: Palette,
    title: 'Slides render on-brand',
    body: 'Deterministic HTML + Chromium → pixel-perfect PNGs. Nine themes, your colors and type, every time.',
  },
  {
    icon: Calendar,
    title: 'Review → approve → ship',
    body: 'Edit inline. Approve. Optionally schedule. Flux talks to Instagram so you don’t have to.',
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
      'Subtle Flux watermark',
      '3 starter themes',
      '1 brand profile',
      '1 Instagram account',
      'Manual approval workflow',
      'Community support',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    cadence: '/month',
    description: 'For solo founders and SMBs posting daily.',
    cta: 'Start free trial',
    ctaHref: '/signup?plan=starter',
    features: [
      '50 carousels / month',
      'No watermark',
      'All 9 themes + brand overrides',
      'Auto-schedule to Instagram',
      '2 brand profiles · 2 IG accounts',
      'Inline caption rewrites',
      'Email support',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$49',
    cadence: '/month',
    description: 'For brands going from monthly to daily output.',
    popular: true,
    cta: 'Start free trial',
    ctaHref: '/signup?plan=growth',
    features: [
      '250 carousels / month',
      'Multi-brand workspaces',
      'Advanced approvals + bulk actions',
      'Analytics + performance feedback',
      '5 brand profiles · 5 IG accounts',
      'Brand kit ingestion (PDF / logo)',
      'Priority support',
    ],
  },
  {
    key: 'agency',
    name: 'Agency',
    price: '$149',
    cadence: '/month',
    description: 'For agencies running content for clients.',
    cta: 'Start free trial',
    ctaHref: '/signup?plan=agency',
    features: [
      'Unlimited brands & IG accounts',
      'Client approval links',
      'White-label exports',
      'Team collaboration + internal notes',
      'Brand-level analytics dashboards',
      'Workspace switcher',
      'Dedicated onboarding',
    ],
  },
];

const faqs = [
  {
    q: 'What does Flux actually do that ChatGPT or Canva doesn’t?',
    a: 'ChatGPT writes text. Canva is a manual editor. Flux is your content desk — it researches the topic, writes the script in your brand voice, renders the slides on-brand, drafts the caption + hashtags, and queues to Instagram. End-to-end. You only step in to review.',
  },
  {
    q: 'Will every post look the same after a few weeks?',
    a: 'No. Flux rotates through hook archetypes, layout rhythms, and tracks your recent posts to avoid repeating itself. The whole point is daily output that doesn’t feel daily.',
  },
  {
    q: 'Can I edit before it ships?',
    a: 'Yes. Edit the caption inline, rewrite it (shorter / more professional / more casual / stronger CTA), regenerate a single slide, or rewrite the CTA. Nothing publishes without your approval.',
  },
  {
    q: 'Do I need an Instagram account to start?',
    a: 'No. On any tier you can produce and review carousels without connecting Instagram. Connect IG when you want Flux to publish for you.',
  },
  {
    q: 'How does pricing work?',
    a: 'You pay by output — carousels per month, brands, and connected IG accounts. No tokens, no per-prompt fees, no AI credit math.',
  },
  {
    q: 'Is this part of WappFlow?',
    a: "Flux is its own product. But if you're on WappFlow Growth or Enterprise, Flux is included in your plan — sign in from your WappFlow dashboard.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <AuroraBackground />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-10">
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
          <AuthCta href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </AuthCta>
          <AuthCta href="/signup" variant="primary" size="sm">
            Start free
            <ArrowRight className="h-3.5 w-3.5" />
          </AuthCta>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-4 pt-12 text-center sm:px-6 sm:pt-24">
        <Badge variant="accent" className="mx-auto">
          <Sparkles className="h-3 w-3" /> Your AI content desk · for SMBs
        </Badge>
        <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Your <GradientText>AI social media team.</GradientText>
          <span className="block text-foreground/80 mt-2 text-3xl font-medium sm:text-5xl">
            On the payroll for $19.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Daily Instagram content without hiring a designer. Flux researches, writes,
          designs, captions, and queues — every post on-brand, every time.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <AuthCta href="/signup" variant="primary" size="lg">
            Start free <ArrowRight className="h-4 w-4" />
          </AuthCta>
          <Button size="lg" variant="outline" asChild>
            <a href="#pricing">See pricing</a>
          </Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          No credit card required · 5 carousels free / month
        </p>
      </section>

      {/* Animated metrics band */}
      <section className="relative mx-auto mt-16 max-w-5xl px-4 sm:mt-24 sm:px-6">
        <Reveal className="grid grid-cols-2 gap-4 rounded-3xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl sm:grid-cols-4 sm:p-8">
          {[
            { v: <Counter to={60} suffix="s" />, label: 'Idea → finished post' },
            { v: <Counter to={40} />, label: 'Cinematic style modes' },
            { v: <Counter to={20} suffix="+" />, label: 'Posts / month, on autopilot' },
            {
              v: (
                <>
                  <span className="align-top text-2xl sm:text-3xl">$</span>
                  <Counter to={19} />
                </>
              ),
              label: 'A month — not $2,400',
            },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold tracking-tight sm:text-5xl">
                <GradientText>{m.v}</GradientText>
              </div>
              <div className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
                {m.label}
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* Feature row */}
      <section className="relative mx-auto mt-20 grid max-w-6xl gap-4 px-4 sm:mt-28 sm:grid-cols-3 sm:px-6">
        {features.map((f) => (
          <div
            key={f.title}
            className="relative rounded-2xl glass p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="relative mx-auto mt-24 max-w-6xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">How it works</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            From idea to <GradientText>published</GradientText> in 60 seconds.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            No drag-and-drop. No prompt engineering. Just topics in, posts out.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl glass p-6">
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

      {/* "Built for daily output" — what makes Flux different */}
      <section className="relative mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">Built for daily output</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            Not your average <GradientText>AI carousel toy</GradientText>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Most AI tools get you 80% there and dump the rest on you. Flux is built
            around the last mile — editing, diversity, brand fidelity, approval.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Pencil,
              title: 'Edit before you ship',
              body: 'Rewrite the caption (shorter / professional / casual / stronger CTA), regenerate a single slide, propose 4 CTA variations — all inline. Nothing publishes until you approve.',
            },
            {
              icon: Shuffle,
              title: 'Diversity engine',
              body: '8 hook archetypes rotate automatically — curiosity, contrarian, story, list, stat, myth-bust… Flux reads your last 12 posts and forbids repeats. Your feed never feels copy-pasted.',
            },
            {
              icon: CheckCheck,
              title: 'Bulk approve',
              body: 'Generate a week of content in a morning. Select 10 carousels, hit approve, walk away. Flux queues them all to Instagram with their captions and hashtags.',
            },
            {
              icon: FileText,
              title: 'Brand kit ingestion',
              body: 'Drop your logo, brand book, style guide, or pitch deck. Flux uses them to keep every post unmistakably yours. PDF, PNG, SVG — drag and drop.',
            },
            {
              icon: Smartphone,
              title: 'Mobile-first approval',
              body: 'Swipe through previews, edit captions, hit approve — all from your phone. The carousel review lives where you are, not chained to a desk.',
            },
            {
              icon: RefreshCw,
              title: 'Visual rhythm variation',
              body: 'Layout archetypes rotate per slide — minimalist, oversized, quote, stat, dense. Slides alternate density so your carousels feel paced, not uniform.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl glass p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Beyond carousels — the newer pillars */}
      <section className="relative mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">More than carousels</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            A whole <GradientText>content studio</GradientText>, not a generator.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Carousels are the start. Flux also plans your month, animates your slides into
            cinematic reels, and learns what your audience actually wants.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Film,
              title: 'Cinematic reels',
              body: 'Turn any carousel into a 9:16 MP4 — Ken Burns motion, crossfades, film grain, and an animated kinetic hook. Renders locally, zero API cost.',
            },
            {
              icon: Calendar,
              title: 'Plan the month',
              body: 'A campaign calendar that generates on-brand topics, schedules them across days, and forges a finished post for each — in one click.',
            },
            {
              icon: Layers,
              title: '40 style modes',
              body: 'Every look is a full personality — type, palette, motion, effects. From Cinematic Movie Poster to Brutalist Editorial. Browse, preview, apply.',
            },
            {
              icon: Compass,
              title: 'Topic intelligence',
              body: 'Paste your site and Flux proposes on-brand ideas, scores them for virality, and clusters them into the content pillars that carry your feed.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl glass p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-gradient">
                <f.icon className="h-5 w-5 text-background" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* "Why daily output kills small brands" — narrative section */}
      <section className="relative mx-auto mt-24 max-w-5xl px-4 sm:mt-32 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl sm:p-10">
          <Badge variant="outline">The real problem</Badge>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Hiring a designer costs <span className="text-foreground/60 line-through">$2,400/mo</span>.{' '}
            <br className="hidden sm:block" />
            <GradientText>Flux costs $19.</GradientText>
          </h2>
          <p className="mt-5 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Daily Instagram output is what compounds. But your time isn’t free, freelancers
            ghost, and Canva still needs someone to sit in front of it. Flux ships the work —
            you ship the brand.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              { label: '8h / week saved', sub: 'No more "what do we post today"' },
              { label: '20+ posts / month', sub: 'Without burning out the founder' },
              { label: '1 brand voice', sub: 'Across every post, every day' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border/40 bg-secondary/30 p-4"
              >
                <div className="text-sm font-semibold">{s.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative mx-auto mt-24 max-w-7xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">Pricing</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            Pay by <GradientText>posts</GradientText>, not tokens.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            No AI credit math. No surprise bills. Just carousels, brands, and IG accounts —
            the numbers that matter.
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
                  <Badge
                    variant="accent"
                    className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]"
                  >
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

              <AuthCta
                href={t.ctaHref}
                variant={t.popular ? 'primary' : 'outline'}
                className="mt-6 w-full justify-center"
                size="lg"
              >
                {t.cta} <ArrowRight className="h-4 w-4" />
              </AuthCta>

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

        {/* Enterprise strip */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-secondary/20 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold">Enterprise</h3>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Self-hosting · BYOK models · SSO · audit logs · custom rendering · SLA.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href="mailto:hello@remoteops.co?subject=Flux%20Enterprise">
                Talk to sales <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Annual billing saves 20%. All paid plans include a 7-day free trial — no
          credit card required.
        </p>
      </section>

      {/* Old way vs the Flux way */}
      <section className="relative mx-auto mt-24 max-w-5xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">Why switch</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
            The old way vs <GradientText>the Flux way</GradientText>.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <Reveal className="rounded-2xl border border-border/50 bg-secondary/20 p-6 sm:p-7">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              The old way
            </div>
            <ul className="mt-5 space-y-3.5">
              {[
                'Stare at a blank Canva every morning',
                '$2,400/mo designer — or a freelancer who ghosts',
                'Every post looks slightly different',
                'Captions + hashtags written from scratch',
                'Reels? Maybe next quarter',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                    <X className="h-3 w-3 text-red-400" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal
            delay={0.1}
            className="rounded-2xl border-2 border-primary/40 bg-gradient-to-b from-primary/10 to-card/60 p-6 shadow-[0_0_40px_-12px_rgba(139,92,246,0.5)] sm:p-7"
          >
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              With Flux
            </div>
            <ul className="mt-5 space-y-3.5">
              {[
                'One topic in → finished carousel out in 60s',
                '$19/mo. No designer, no Canva',
                'Locked to your brand — every post, every time',
                'Captions + hashtags written in your voice',
                'One-click cinematic reels, on autopilot',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* CTA strip */}
      <section className="relative mx-auto mt-24 max-w-5xl px-4 sm:mt-32 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-violet-600/15 to-cyan-500/15 p-8 text-center backdrop-blur-xl sm:p-10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_30%,rgba(139,92,246,0.35),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.25),transparent_60%)]" />
          <Sparkles className="mx-auto h-7 w-7 text-primary" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-4xl">
            Stop staring at a blank Canva.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            5 carousels free, every month. Connect Instagram when you’re ready. Cancel any
            time.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <AuthCta href="/signup" variant="primary" size="lg">
              Start free <ArrowRight className="h-4 w-4" />
            </AuthCta>
            <Button size="lg" variant="outline" asChild>
              <a
                href="https://wappflow.remoteops.co"
                target="_blank"
                rel="noopener noreferrer"
              >
                Already on WappFlow? <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative mx-auto mt-24 max-w-3xl px-4 sm:mt-32 sm:px-6">
        <div className="text-center">
          <Badge variant="outline">FAQ</Badge>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
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

      <footer className="relative mt-24 border-t border-border/40 px-4 py-8 text-xs text-muted-foreground sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="opacity-70">v0.3 — beta</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
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
