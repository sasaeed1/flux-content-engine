# Flux — Free-Tier AI Provider Setup

> Your spec's "Implementation Flow" says: build the orchestration first, **then**
> hand over provider onboarding. The orchestration is complete (`src/ai/`), so
> here's exactly what to get, how many keys, where, and how Flux uses them.
>
> **All keys are backend-only.** They live in the engine's `.env` (on the server
> at `/opt/flux/.env`) and never reach the browser. After you add them, restart
> the app (`docker compose up -d` in `/opt/flux`) — no code changes needed; the
> router picks them up on boot.

---

## 1. Which providers — and the priority order Flux uses

Flux's router (`src/ai/providers/index.ts`) already supports **8 providers** and
routes by priority → health → remaining quota, failing over automatically. Every
provider reads a **comma-separated list of keys** for round-robin rotation across
multiple free accounts.

| Priority | Provider | Free daily budget* | Critical? | Best for |
|---|---|---|---|---|
| 100 | **Groq** | ~14k req/key | ✅ Critical | Fast hooks, captions, command parsing |
| 95 | **Cloudflare Workers AI** | ~9k/key (biggest free tier) | ★ Recommended | High-volume fast generation |
| 90 | **Gemini** | ~1.4k/key | ★ Recommended | Reasoning, storytelling, scoring |
| 80 | OpenRouter | ~180/key | Optional | Overflow + extra free models |
| 60 | HuggingFace | ~900/key | Optional | Utility / preprocessing |
| 50 | Together | ~60/key | Optional | Last-mile fallback |
| 30 | OpenAI | (paid) | Off by default | Only if `ALLOW_PAID_FALLBACK=true` |
| 10 | Ollama | local/unlimited | Optional | Self-host fallback, zero-cost |

\* These are the conservative soft caps in `src/config/env.ts` (`QUOTA_DAILY_*`),
set **below** each provider's published free tier so the quota tracker rotates
off a key before it gets throttled.

---

## 2. Minimum viable setup (do this first)

To run Flux comfortably on **$0**, get these three — they cover ~95% of load:

1. **Groq** (already required) — fastest, most generous.
2. **Cloudflare Workers AI** — biggest free tier; carries the volume.
3. **Gemini** — the reasoning tier for storytelling + topic scoring.

**Recommended key counts:** 2–3 keys each (separate free accounts → comma-separate
them). With 3 keys/provider you triple each daily budget for free.

---

## 3. Where to get each key + the exact `.env` var

```bash
# --- Groq (critical) ---  https://console.groq.com/keys
GROQ_API_KEY=gsk_...                 # primary
GROQ_API_KEYS=gsk_acct2,gsk_acct3    # extra accounts (comma-separated, rotated)

# --- Cloudflare Workers AI (recommended) ---
# Dash → AI → Workers AI → "Use REST API". You need the Account ID + an API token
# with the "Workers AI" permission. https://dash.cloudflare.com
CLOUDFLARE_AI_ACCOUNT_ID=xxxxxxxx
CLOUDFLARE_AI_API_KEYS=token1,token2

# --- Gemini (recommended) ---  https://aistudio.google.com/app/apikey
GEMINI_API_KEYS=AIza_key1,AIza_key2

# --- OpenRouter (optional) ---  https://openrouter.ai/keys
OPENROUTER_API_KEYS=sk-or-key1

# --- HuggingFace (optional) ---  https://huggingface.co/settings/tokens  (Read token)
HUGGINGFACE_API_KEYS=hf_key1

# --- Together (optional) ---  https://api.together.ai/settings/api-keys
TOGETHER_API_KEYS=together_key1

# --- OpenAI (optional, PAID) — leave off unless you want a paid safety net ---
# ALLOW_PAID_FALLBACK=true
# OPENAI_API_KEY=sk-...
```

The model names per provider have sensible free-tier defaults already set in
`env.ts` (e.g. Groq `llama-3.3-70b-versatile`, Gemini `gemini-2.0-flash-exp`,
Cloudflare `@cf/meta/llama-3.1-8b-instruct`). Override only if you want to.

---

## 4. Workload routing (already implemented)

The router exposes two tiers; callers pick one and the router maps it to the best
configured provider:

- **fast** → hooks, captions, command parsing, classification → Groq / Cloudflare
  (8B-class, sub-second).
- **reasoning** → carousel storytelling, topic scoring → Gemini / 70B models.

Local utilities (Ollama) can do preprocessing for free when self-hosted.

---

## 5. Free-tier optimization (built in — nothing to configure)

- **Aggressive caching:** deterministic calls at/below `CACHE_MAX_TEMPERATURE`
  (0.4) are cached for 14 days (scoring, classification, command parsing).
  Creative high-temp generation is **not** cached, preserving variety.
- **Quota-aware rotation:** `quotaTracker` counts per-key/per-day and rotates to
  the next key/provider before a key hits its cap.
- **Circuit breaker:** a failing provider is cooled off and traffic fails over;
  it's auto-probed back when healthy.
- **Multi-key round-robin:** N free accounts per provider = N× the daily budget.

---

## 6. Smart workarounds (legitimate free-tier maximization)

- **Stack free accounts:** each provider's key list is comma-separated — add 2–3
  free accounts per provider and Flux rotates through them.
- **Lead with Cloudflare:** it has the largest free allowance — it's priority 95
  so it absorbs volume, keeping Groq's budget for latency-critical calls.
- **Keep `IMAGE_PROVIDER=none`:** slides are composed from templates + 40 style
  modes (zero image-gen cost). Reels are zero-cost ffmpeg. Only turn on paid
  image-gen when you specifically want AI backgrounds.
- **Ollama for bursts:** when you self-host, pin `ollama` for overflow so spikes
  never touch paid providers.

---

## 7. After you add keys

1. Paste them into `/opt/flux/.env` on the server.
2. `cd /opt/flux && docker compose up -d` (restart the app container).
3. Check the provider plane: it's surfaced in the app under **Settings/Signals**
   and via `GET /api/tenant/intelligence/providers` (shows configured providers,
   per-key usage today, and health).

That's it — the orchestration layer integrates new keys automatically.
