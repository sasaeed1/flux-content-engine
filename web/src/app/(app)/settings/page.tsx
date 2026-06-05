import { Suspense } from 'react';
import { Activity, ArrowRight, Camera, Check, Key, Layers, Share2, Shield, Sparkles, User } from 'lucide-react';
import { PageHeader } from '@/components/flux/page-header';
import { Badge } from '@/components/ui/badge';
import { InstagramConnect } from '@/components/settings/instagram-connect';
import { Connections } from '@/components/settings/connections';
import { ApiKeyReveal } from '@/components/settings/api-key-reveal';
import { BrandKitUpload } from '@/components/settings/brand-kit-upload';
import { SystemSettings } from '@/components/settings/system-settings';
import { api } from '@/lib/api-client';
import type {
  FluxSettings,
  InstagramAccount,
  Organization,
  PlatformDescriptor,
  SocialConnectionPublic,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Flux' };

const TIER_COPY: Record<string, { label: string; color: string; desc: string }> = {
  free: {
    label: 'Free',
    color: 'bg-zinc-700/40 text-zinc-200',
    desc: 'Groq free tier · 5 carousels / month',
  },
  starter: {
    label: 'Starter',
    color: 'bg-violet-600/30 text-violet-100',
    desc: 'Paid LLM · 25 carousels / month',
  },
  growth: {
    label: 'Growth',
    color: 'bg-cyan-600/30 text-cyan-100',
    desc: 'Image gen + scheduling · 100 carousels / month',
  },
  enterprise: {
    label: 'Enterprise',
    color: 'bg-pink-600/30 text-pink-100',
    desc: 'Unlimited · custom models · priority support',
  },
};

const PLAN_PERKS: Record<string, string[]> = {
  free: [
    '5 carousels / month',
    '40 cinematic style modes',
    'Cinematic reels — rendered locally, zero cost',
    'Manual approval workflow',
    '1 brand profile · 1 Instagram account',
  ],
  starter: [
    '50 carousels / month',
    'No watermark',
    'Auto-schedule to Instagram',
    'Inline caption + slide rewrites',
    '2 brand profiles · 2 Instagram accounts',
  ],
  growth: [
    '250 carousels / month',
    'Multi-brand workspaces',
    'Analytics + performance feedback',
    'Brand-kit ingestion (PDF / logo)',
    '5 brand profiles · 5 Instagram accounts',
  ],
  enterprise: [
    'Unlimited brands & Instagram accounts',
    'Client approval links + white-label exports',
    'Custom models / BYOK',
    'SSO + audit logs',
    'Priority support + dedicated onboarding',
  ],
};

export default async function SettingsPage() {
  let org: Organization | null = null;
  let accounts: InstagramAccount[] = [];
  let brandAssets: Awaited<ReturnType<typeof api.listBrandAssets>>['assets'] = [];
  let settings: FluxSettings | null = null;
  let platforms: PlatformDescriptor[] = [];
  let socialConnections: SocialConnectionPublic[] = [];
  let connectionError: string | null = null;

  try {
    const [meRes, igRes, baRes, setRes, connRes] = await Promise.all([
      api.me(),
      api.listInstagramAccounts(),
      api.listBrandAssets().catch(() => ({ assets: [] })),
      api.settings().catch(() => null),
      api.connections().catch(() => ({ platforms: [], connections: [] })),
    ]);
    org = meRes.organization;
    accounts = igRes.accounts;
    brandAssets = baRes.assets ?? [];
    settings = setRes?.settings ?? null;
    platforms = connRes.platforms ?? [];
    socialConnections = connRes.connections ?? [];
  } catch (err) {
    connectionError = err instanceof Error ? err.message : 'Engine unreachable';
  }

  const tier = (org?.subscription_tier ?? 'free').toLowerCase();
  const tierInfo = TIER_COPY[tier] ?? TIER_COPY.free;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title={
          <>
            Your <span className="gradient-text">settings</span>.
          </>
        }
        subtitle="Everything that shapes how Flux works for you — defaults, connections, brand, plan, and access. All in one place."
      />

      {/* Sticky section nav — jump anywhere, stay in control */}
      <nav className="sticky top-16 z-10 -mx-1 flex flex-wrap gap-1.5 rounded-xl border border-edge-subtle bg-surface-0/80 px-2 py-2 backdrop-blur-xl">
        {[
          { href: '#workspace', label: 'Workspace' },
          { href: '#defaults', label: 'Defaults' },
          { href: '#brand-kit', label: 'Brand kit' },
          { href: '#instagram', label: 'Instagram' },
          { href: '#channels', label: 'Channels' },
          { href: '#api', label: 'API' },
          { href: '#plan', label: 'Plan & usage' },
          { href: '#danger', label: 'Danger' },
        ].map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="press rounded-md px-2.5 py-1.5 text-[13px] font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {connectionError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-red-200">
          {connectionError}
        </div>
      )}

      {/* Workspace card */}
      <section id="workspace" className="scroll-mt-32 rounded-2xl glass p-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{org?.name ?? 'Workspace'}</h2>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {org?.slug ? `/${org.slug}` : org?.id?.slice(0, 8)}
              </p>
            </div>
          </div>
          <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
        </header>

        <p className="mt-4 text-sm text-muted-foreground">{tierInfo.desc}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile icon={Activity} label="Status" value={org?.active ? 'Active' : 'Paused'} />
          <Tile
            icon={Sparkles}
            label="AI provider"
            value={(org?.ai_provider ?? 'groq').toUpperCase()}
          />
          <Tile icon={Shield} label="Tier" value={tierInfo.label} />
        </div>
      </section>

      {settings && (
        <div id="defaults" className="scroll-mt-32">
          <SystemSettings initial={settings} />
        </div>
      )}

      {/* Brand kit */}
      <section id="brand-kit" className="rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Brand kit</h2>
            <p className="text-sm text-muted-foreground">
              Drop your logos, brand books, style guides, or pitch decks here so
              Flux can keep every post on-brand.
            </p>
          </div>
          <Badge variant={brandAssets.length ? 'success' : 'outline'}>
            {brandAssets.length} asset{brandAssets.length === 1 ? '' : 's'}
          </Badge>
        </header>

        <div className="mt-6">
          <BrandKitUpload assets={brandAssets} />
        </div>
      </section>

      {/* Instagram accounts */}
      <section id="instagram" className="scroll-mt-32 rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Camera className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Instagram accounts</h2>
            <p className="text-sm text-muted-foreground">
              Connect an Instagram Business or Creator account to publish carousels.
              Until you connect one, carousels are produced for review only — Flux
              won&apos;t auto-publish.
            </p>
          </div>
          <Badge variant={accounts.length ? 'success' : 'outline'}>
            {accounts.length} connected
          </Badge>
        </header>

        <div className="mt-6">
          <Suspense>
            <InstagramConnect accounts={accounts} />
          </Suspense>
        </div>
      </section>

      {/* Channels — multi-platform publishing */}
      <section id="channels" className="scroll-mt-32 rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Publishing channels</h2>
            <p className="text-sm text-muted-foreground">
              Connect LinkedIn, TikTok, and Instagram to cross-post your carousels + reels. Paste a
              token to connect now — one-click OAuth lights up once the platform API keys are added.
            </p>
          </div>
          <Badge variant={socialConnections.length ? 'success' : 'outline'}>
            {socialConnections.length} connected
          </Badge>
        </header>
        <div className="mt-6">
          <Connections platforms={platforms} connections={socialConnections} />
        </div>
      </section>

      {/* API key */}
      <section id="api" className="scroll-mt-32 rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">API key</h2>
            <p className="text-sm text-muted-foreground">
              Server-only — never expose this in browser code. Use it to call the
              Flux engine directly or to integrate from your own services.
            </p>
          </div>
        </header>

        <div className="mt-5">
          <ApiKeyReveal apiKey={org?.api_key ?? ''} />
        </div>
      </section>

      {/* Plan & usage */}
      <section id="plan" className="scroll-mt-32 rounded-2xl glass p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-flux-soft">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Plan &amp; usage</h2>
            <p className="text-sm text-muted-foreground">
              Your workspace tier and what it unlocks.
            </p>
          </div>
          <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
        </header>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {(PLAN_PERKS[tier] ?? PLAN_PERKS.free).map((perk) => (
            <div key={perk} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span>{perk}</span>
            </div>
          ))}
        </div>

        {tier === 'free' && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
            <p className="text-sm text-muted-foreground">
              Want no watermark, auto-scheduling, and 50+ carousels a month?
            </p>
            <a
              href="/#pricing"
              className="inline-flex items-center gap-1.5 rounded-lg bg-flux-gradient px-3.5 py-2 text-sm font-semibold text-flux-ink glow-cta"
            >
              Upgrade <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section id="danger" className="scroll-mt-32 rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-6">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <Shield className="h-5 w-5 text-red-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-100">Danger zone</h2>
            <p className="text-sm text-red-200/80">
              Workspace deletion and tier downgrades coming soon. For now, email
              support to delete your workspace.
            </p>
          </div>
        </header>
      </section>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  );
}
