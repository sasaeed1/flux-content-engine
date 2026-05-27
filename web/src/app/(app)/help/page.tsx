import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  ExternalLink,
  Images,
  LifeBuoy,
  Mail,
  Palette,
  PlayCircle,
  Send,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Help · Flux' };

const FLOW = [
  {
    icon: Brain,
    title: '1 · Pick a topic',
    body: 'Type one in or have Flux generate a fresh batch grounded in your brand.',
  },
  {
    icon: Wand2,
    title: '2 · Flux writes the script',
    body: 'Hook, body slides, CTA — written in your voice with your keywords.',
  },
  {
    icon: Palette,
    title: '3 · Slides get rendered',
    body: 'Server-side HTML → Chromium → PNG. Deterministic, on-brand every time.',
  },
  {
    icon: Send,
    title: '4 · Review, approve, publish',
    body: 'Open the library, hit approve, optionally schedule. Flux handles the rest.',
  },
];

const FAQ = [
  {
    q: 'What does Flux cost to run?',
    a: 'On the Free tier, Flux uses the Groq free LLM and renders slides locally — so the only real cost is the carousels you publish to Instagram. Paid tiers will unlock premium models, image generation, and higher limits.',
  },
  {
    q: 'Do I need a designer?',
    a: 'No. Flux ships nine theme presets (Minimal, Bold, Editorial, Dark Luxe, Pastel, Cyber, Organic, Studio, Reset) and your brand profile drives the visuals. You can override colors and typography if you want.',
  },
  {
    q: 'Can I edit a caption before publishing?',
    a: 'Yes — open any carousel in the library. You can edit the caption inline before approving. (Slide-level editing coming next.)',
  },
  {
    q: 'How is "voice" actually applied?',
    a: 'Your brand profile holds voice keywords (always-use), voice-avoid (never-use), tone, post style, and CTA style. The LLM gets this as context on every generation — captions, hooks, and CTAs all reflect it.',
  },
  {
    q: 'Will Flux post automatically without my approval?',
    a: 'Only if you connect an Instagram account AND request approvalMode=auto when you trigger a run. The default is manual — Flux produces, you approve.',
  },
];

const RESOURCES = [
  { icon: BookOpen, label: 'Quick-start guide', href: '#quick-start' },
  { icon: PlayCircle, label: 'Watch a 90-second demo', href: '#demo' },
  { icon: Camera, label: 'Connect Instagram', href: '/settings#instagram' },
  { icon: Sparkles, label: 'Brand profile setup', href: '/brand' },
  { icon: Images, label: 'Open the library', href: '/library' },
];

export default function HelpPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Help & docs"
        title={
          <>
            Get the most out of <span className="gradient-text">Flux</span>.
          </>
        }
        subtitle="A 90-second tour, common questions, and direct lines to support."
        actions={
          <Badge variant="accent">
            <LifeBuoy className="mr-1 h-3 w-3" /> v0.2 · Beta
          </Badge>
        }
      />

      {/* Quick resources strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {RESOURCES.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className="group flex items-center gap-3 rounded-2xl glass px-4 py-3 transition hover:border-primary/30"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-flux-soft">
              <r.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1 text-sm font-medium group-hover:text-primary">
              {r.label}
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </section>

      {/* How Flux works */}
      <section id="quick-start" className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          How Flux works
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl glass p-5 transition hover:border-primary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-gradient text-background">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Instagram setup */}
      <section id="instagram" className="rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Camera className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Connecting Instagram</h2>
        </header>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">1.</strong> Convert your IG account to a{' '}
            <strong className="text-foreground">Business</strong> or{' '}
            <strong className="text-foreground">Creator</strong> account (Settings → Account
            type).
          </li>
          <li>
            <strong className="text-foreground">2.</strong> Link it to a Facebook Page you
            manage.
          </li>
          <li>
            <strong className="text-foreground">3.</strong> Generate a long-lived user
            access token via{' '}
            <a
              href="https://developers.facebook.com/tools/explorer/"
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Graph API Explorer <ExternalLink className="inline h-3 w-3" />
            </a>{' '}
            with scopes{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">instagram_basic</code>{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">instagram_content_publish</code>{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">pages_show_list</code>.
          </li>
          <li>
            <strong className="text-foreground">4.</strong> Get your IG Business Account
            ID via{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">
              GET /me/accounts?fields=instagram_business_account
            </code>
            .
          </li>
          <li>
            <strong className="text-foreground">5.</strong> Paste both into{' '}
            <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings → Instagram accounts
            </Link>
            . Flux will store the token encrypted at rest.
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          Native OAuth (no manual tokens) is coming. For now this manual flow is the only
          option Meta exposes for self-hosted apps.
        </p>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Frequently asked
        </h2>
        <div className="divide-y divide-border/60 overflow-hidden rounded-2xl glass">
          {FAQ.map((item) => (
            <details key={item.q} className="group p-5 transition open:bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="text-sm font-medium">{item.q}</span>
                <span className="ml-4 text-muted-foreground transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Need a human?</h2>
            <p className="text-sm text-muted-foreground">
              Email us anytime. We aim to reply within 24 hours.
            </p>
          </div>
          <Link
            href="mailto:hello@remoteops.co?subject=Flux%20support"
            className="inline-flex items-center gap-2 rounded-xl bg-flux-gradient px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> hello@remoteops.co
          </Link>
        </header>
      </section>
    </div>
  );
}
