# Flux Redesign Blueprint

> The AI-native reimagining. Build spec for the 12-step transformation.
> North star: Flux is a **creative organism**, not an app — an intelligent creative machine always slightly ahead of you.

## North Star
Every surface answers one of three questions: "what's worth creating right now?", "what is Flux seeing that I'm not?", "how do I bring this idea to life?". Center of gravity = the **Forge** (generation). Persistent **Command Rail** (left) + summonable **Copilot** (right) make AI omnipresent. Dark cinematic + proprietary deep-violet/electric-cyan signature, real film grain, layered glass with true elevation, unified motion language (ambient glow, thinking shimmers, streaming reveals all = intelligence).

## Design tokens (palette)
```
ink #06070B · ink-2 #0A0C12
surface-0 #0C0E16 · surface-1 #10131D · surface-2 #161A28 · surface-3 #1E2336   (each +~4% brightness = depth)
border-subtle #1C2030 · border-strong #2A3047 · border-glow #3D2E7A
fg #F2F4FA · fg-muted #9BA3B7 · fg-dim #646B80
violet #8B5CF6 · violet-deep #6D28D9 · violet-bright #A78BFA
cyan #22D3EE · cyan-deep #0E9FBF · cyan-bright #67E8F9
magenta #EC4899 · magenta-deep #BE2D7E · gold #F5B544
aurora-core #5D2E9B · signal-electric #00D9FF
success #34D399 / bg #0E2A22 · warning #FBBF24 / bg #2A220C · danger #F87171 / bg #2A1318 · info #60A5FA
thinking #A78BFA (violet)  ·  primary #22D3EE (cyan)  ·  accent #8B5CF6 (violet)
```
**Color meaning:** violet = AI thinking/intelligence · cyan = interactive/focus · gold = opportunity/performance.

## Typography
- display: **Space Grotesk** (hero numbers + page titles), sans: Inter var (cv11,ss01,ss03), mono: JetBrains Mono (telemetry/kbd/scores)
- hero clamp(2.5rem,5vw,4rem)/600/-0.03em/1.0 · h1 2rem/600/-0.02em · h2 1.5rem/600 · h3 1.125rem/600
- body .9375rem/400/1.6 · small .8125rem · label .6875rem/700/uppercase/.16em · mono-stat .75rem/600/.04em
- weights: 400 body, 500 medium, 600 headings+buttons, 700 labels only

## Surfaces & glass
- 4 levels surface-0 (page) → 1 (resting card) → 2 (raised/hover) → 3 (popover). Depth by brightness, not blur.
- glass-panel: `linear-gradient(180deg, hsla(228,28%,11%,.72), hsla(230,30%,7%,.72))` + `blur(20px) saturate(140%)` + border rgba(255,255,255,.07), top-edge .10
- glass-frosted (cmdk/overlay): `blur(28px) saturate(160%)` + `linear-gradient(180deg, rgba(14,16,26,.88), rgba(8,9,16,.92))`
- solid-card (content, NOT glass): bg surface-1, border border-subtle; hover → surface-2 + border-strong
- grain: body::before fractal-noise at **0.09** (was .035) overlay + second static 0.04 fine layer
- inset-sheen: `inset 0 1px 0 0 rgba(255,255,255,.06)` on all raised surfaces
- aurora-field (home/forge): 3 radial blobs .16/.13/.10, 140px blur, slow drift

## Glow / elevation
```
glow-primary (cyan focus): 0 0 0 1px hsla(188,95%,53%,.5), 0 0 24px -2px hsla(188,95%,53%,.45)
glow-thinking (violet AI): 0 0 32px -4px rgba(139,92,246,.55), 0 0 0 1px rgba(139,92,246,.35) + pulse-think
glow-elev-1: 0 4px 16px -6px rgba(0,0,0,.5)
glow-elev-2: 0 12px 32px -12px rgba(0,0,0,.6), 0 2px 8px -4px rgba(0,0,0,.4)
glow-elev-3: 0 32px 80px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04)
glow-aura-cta: 0 10px 40px -12px rgba(34,211,238,.5), 0 0 0 1px rgba(34,211,238,.2)
text-glow: drop-shadow(0 0 24px rgba(139,92,246,.35))
conic-halo: conic-gradient(from var(--angle), #8B5CF6,#22D3EE,#EC4899,#8B5CF6) masked ring, --angle animated
```

## Radii
xs .4rem (chips/kbd/badge) · sm .6rem (button/input) · md .85rem (card/tile) · lg 1.1rem (panel/hero) · xl 1.5rem (modal/forge) · pill 999px · --radius .85rem base (shadcn compat)

## Motion vocabulary
- **pulse-think** 1.8s — violet shadow+opacity breathe = "AI working", applied to any in-flight element
- **conic-spin** --angle 0→360 3s linear — conic-halo ring around Forge canvas during gen
- **shimmer-sweep** 1.2s diagonal light travel — active reasoning (distinct from skeleton shimmer)
- **slide-build** clip-path scan-line inset(0 100% 0 0)→inset(0) + scale .96→1, 600ms cubic(.16,1,.3,1) — per-slide gen reveal
- **stagger-reveal** children 60ms incremental fadeUp+6px — feed/grid/variations
- **aurora-drift** 30s translate+rotate blobs (replaces 22s aurora)
- **engine-pulse** 3s breathe idle → 0.9s ripple when thinking — rail orb
- **count-roll** number tween 700ms digit-by-digit
- **glow-focus-in** 150ms glow-primary ring on focus
- **press-depress** 90ms scale .97 + brightness .95 on :active
- **page-cross** AnimatePresence: out fades+scale .99, in rise 8px+fade 280ms
- **success-bloom** one-shot radial cyan→transparent + sparkle on ship/approve
- **letter-stagger-hook** hero word-by-word 40ms
- **copilot-slide** spring x:24→0 320ms + stagger suggestions

## Information Architecture (old → new)
Nav model: **Command Rail** (72/248px, intent-grouped Discover/Create/Manage, mode switcher top recolors accent, Engine Pulse bottom) + summonable **Copilot** drawer + global **Cmd-K**. Same nav on mobile (bottom tab bar mirrors 5 primary). Forge bound to hotkey `C` + always-visible CTA.

| Name | Route | Purpose | Icon |
|---|---|---|---|
| Home | /home | Living opportunity surface (replaces /dashboard) | Sparkles |
| Forge | /forge | Immersive generation chamber (absorbs /studio) | Wand2 |
| Library | /library | Body of work, /library/[id] detail | LayoutGrid |
| Brand Studio | /brand | Voice + Looks tabs (merges /brand + /themes) | Fingerprint |
| Signals | /signals | Performance + intelligence (Analytics mode) | Activity |
| Settings | /settings | Sectioned tabs (Connections/API/Plan/Workspace) | Settings |

Redirects: /dashboard→/home · /studio→/forge · /carousels/[id]→/library/[id] · /themes→/brand?tab=looks · /help→Copilot Learn.

## Home — "Mission Control for your imagination"
Opens with personal brief ("Good evening. 3 opportunities worth your attention."), streams a prioritized DO feed. Sections:
1. **Brief Bar** (AI) — time-aware greeting + 1-sentence day synthesis + Open the Forge CTA + mode chip
2. **Opportunity Feed** (AI) — centerpiece; intelligence.insights as TREND/OPTIMIZE/NEXT-ACTION/DISCOVERY cards, one-click deep-link into Forge pre-filled, stagger-reveal + confidence
3. **Continue Creating** — resumable drafts/abandoned topics, horizontal cinematic thumbnails
4. **Trending For You** (AI) — niche topic/hook spark chips → launch Forge seeded
5. **Telemetry Strip** — slim row Pending·Ready·Scheduled·Published + sparkline + delta (demoted from hero)
6. **Pulse Log** (AI) — live ticker of what Flux did (analyzed 12 carousels, found 3 trends) = visible heartbeat

## Forge — the generation chamber
Full-bleed creative chamber (NOT 3-col form). Cinematic canvas center, commanding creation bar bottom (Perplexity-style) that expands as Flux responds. Live dialogue, not submit-and-wait. Flow:
1. ENTER — dark/calm, aurora breathing, centered "What do you want to create?", creation bar thinking-pulse, spark chips
2. TYPE & THINK — violet thinking-shimmer on bar; Copilot reacts real-time, proposes 2-3 angle chips (ambient, not a button)
3. STYLE PREVIEW ON YOUR WORDS — style strip; selecting renders live sample slide w/ YOUR topic+hook (reuse MotionPreview); one style gets gold "recommended for this topic"
4. IGNITE (Cmd+Enter) — bar collapses into HUD, conic-halo ignites, phase timeline = horizontal reasoning track granular ("Writing slide 3/6 (Hero) → Rendering")
5. MATERIALIZE — slides arrive with scan-line build + role label revealed first (Hook/Proof/CTA); active slide glows thinking-aura; confidence meter ticks
6. STAY & SCULPT — no auto-redirect; variations bar appears (Regenerate cinematic / Sharper hook / Tighter CTA / Edgier tone), each one-click + visual diff, branch to compare
7. SHIP OR SEND BACK — inline approval (schedule/approve/send to Library); success-bloom; added to Continue-Creating; never lose the chamber

## AI presence (everywhere)
Engine Pulse orb (rail bottom, live state tooltip) · ambient thinking-shimmer (any in-flight element) · Opportunity Feed (Home hero) · contextual Copilot (reacts to surface) · inline Forge angle/style suggestions mid-typing · granular reasoning track during gen · live confidence/quality meters · Pulse Log ticker · Cmd-K AI-first w/ streaming thinking · observing empty states ("Flux is observing — 3 starting points") · performance whispers on Library cards (+45% vs avg) · inline diff rationale on regen.

## Build order (dependency-aware)
1. **Design-system foundation** — globals.css + tailwind.config.ts + Space Grotesk in layout. (none)
2. **Shared primitives** — Button/Card/Input/Skeleton/Badge/GradientText/PageHeader/AuroraBackground. (1)
3. **Motion + AI-presence primitives** — useEngineActivity, EnginePulse, PageTransition. (1,2)
4. **Nav shell** — CommandRail + MobileNav + Topbar + AppLayout. (1,2,3)
5. **Generalized insight card** — PresenceCard rebuild. (1,2,3)
6. **Home** — /home + Brief/Opportunity/Continue/Trending/Telemetry/Pulse; /dashboard→/home. (1-5)
7. **Copilot** — CopilotPanel global drawer. (3,4,5)
8. **Forge** — /forge + ForgeChamber + CreationBar + ReasoningTrack + LiveStylePreview + StyleBrowser. (1-7)
9. **Forge iteration** — VariationsBar + diff + success-bloom; /studio→/forge. (8)
10. **Library + detail** — LibraryGrid filters + whispers; /library/[id]. (1-5,7)
11. **Brand Studio** — Voice|Looks tabs; /themes→/brand?tab=looks. (1-5,7)
12. **Signals + Settings + mode behavior** — /signals, sectioned /settings, mode recolors rail. (1-7)
