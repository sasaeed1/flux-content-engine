# Flux — web dashboard

The browser-facing surface for the **Flux content engine** (`../`). Built with
Next.js 15 + React 18 + Tailwind 3 + Radix primitives, all in TypeScript.

```
web/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Marketing landing
│   │   ├── layout.tsx            # Root layout, fonts, theme color
│   │   └── (app)/                # Authenticated app shell
│   │       ├── layout.tsx        # Sidebar + topbar
│   │       ├── dashboard/        # Stats, runs, quick actions
│   │       ├── brand/            # Brand profile editor
│   │       ├── themes/           # Theme presets gallery
│   │       ├── library/          # Carousel grid
│   │       └── carousels/[id]/   # Carousel detail + approve
│   ├── components/
│   │   ├── ui/                   # shadcn-style primitives (button, card…)
│   │   ├── flux/                 # Brand-specific components (logo, aurora…)
│   │   ├── nav/                  # Sidebar + topbar
│   │   ├── dashboard/            # Stat cards, recent runs
│   │   ├── brand/                # Brand form
│   │   ├── themes/               # Theme card
│   │   ├── library/              # Carousel grid card
│   │   └── carousel/             # Slide strip, approval bar
│   └── lib/
│       ├── api-client.ts         # Server-only fetch wrapper to the engine
│       ├── types.ts              # Lightweight DTOs
│       ├── utils.ts              # cn()
│       └── format.ts             # fmtRelative, fmtNumber…
└── package.json
```

## Quick start

```bash
cd web
npm install
cp .env.local.example .env.local   # already filled with the demo org key
npm run dev                         # http://localhost:3000
```

The engine **must** be running at the URL in `.env.local`
(`CONTENT_ENGINE_URL`, default `http://localhost:8090`). The dashboard fails
gracefully if it isn't.

## Design system — Flux

| Token       | Value                                          |
| ----------- | ---------------------------------------------- |
| Background  | `#08090C` (deep ink with cool tint)            |
| Primary     | `#22D3EE` (Flux cyan)                          |
| Accent      | `#A78BFA` (Flux violet)                        |
| Magenta     | `#EC4899`                                      |
| Type        | Inter (UI), JetBrains Mono (code)              |
| Radius      | `0.85rem`                                      |
| Glass       | `backdrop-blur(14px)` over translucent panels  |
| Aurora      | 3 large, animated, blurred gradient blobs      |
| Gradient    | `linear-gradient(135deg, #A78BFA, #22D3EE, #EC4899)` |

Every page uses the same shell:

- **Sidebar** — Flux logo, primary nav, engine status, version chip.
- **Topbar** — search, workspace pill, notifications.
- **Aurora** — only on the landing/marketing page.
- **Glass cards** — primary surface; hover lifts and tints with the primary glow.

## Auth (preview)

The dashboard is single-tenant in preview mode: it reads
`CONTENT_ENGINE_ORG_API_KEY` from `.env.local` and forwards it as
`x-org-api-key` on every request. Multi-tenant login (Supabase Auth → org
membership → server-side cookie) is on the roadmap.

## Scripts

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Start Next dev server on :3000         |
| `npm run build`      | Production build                       |
| `npm run start`      | Run the production build               |
| `npm run typecheck`  | TypeScript-only check, no emit         |
| `npm run lint`       | `next lint` (uses default Next config) |

## Notes

- **All engine calls happen in Server Components / Server Actions.** The org API
  key never reaches the browser. See `src/lib/api-client.ts`.
- **`next/image` remote patterns** are restricted to Supabase Storage. Add other
  CDNs in `next.config.ts` if needed.
- **No client-side state library** — server components + `useTransition` cover
  every interaction we need today.
