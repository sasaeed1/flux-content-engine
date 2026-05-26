# Deployment Guide

Step-by-step setup from API keys to a running multi-tenant content engine.

---

## 1. Get your API keys

| Service     | Where                                         | What you need                          |
| ----------- | --------------------------------------------- | -------------------------------------- |
| Supabase    | supabase.com → New project                    | URL + **service_role** key             |
| Groq        | console.groq.com/keys                         | `GROQ_API_KEY` (free)                  |
| OpenAI      | platform.openai.com (optional)                | `OPENAI_API_KEY` + paid credit         |
| Ollama      | ollama.com (self-host, optional)              | running on `http://localhost:11434`    |
| Instagram   | developers.facebook.com                       | per-org Graph API token (see §3)       |

---

## 2. Supabase

1. Create a project. Copy **Project URL** and **`service_role`** secret into
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
2. SQL editor → run **`db/schema.sql`** then **`db/seed.sql`**.
3. Storage buckets (`content-images`, `content-renders`, `brand-logos`) are
   auto-created by the service on first boot.

> The schema replaces the previous video-era tables (which only held test
> data). Comment out the leading `DROP TABLE` block in `schema.sql` if you
> want to keep them.

---

## 3. Instagram Graph API (per organization)

Each tenant connects their own IG account. Credentials live on the
`instagram_accounts` table — never in `.env`.

1. Account: convert to **Business** or **Creator** and link to a Facebook Page.
2. App: developers.facebook.com → create app → add **Instagram Graph API**.
3. Generate a long-lived **user access token** with scopes:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement`, `business_management`.
4. Find the **Instagram Business Account id**:
   ```
   GET /me/accounts                    -> page id
   GET /{page-id}?fields=instagram_business_account
   ```
5. Insert via SQL or the admin route:
   ```sql
   insert into instagram_accounts
     (organization_id, ig_business_account_id, ig_access_token, username, is_default, active)
   values
     ('<org-uuid>', '<ig-business-id>', '<long-lived-token>', '@yourbrand', true, true);
   ```

Reels/Carousel publishing rate limit: **~25 posts / IG account / 24h** (Meta).
The `publish_queue` lets you respect it.

---

## 4. Renderer (Chrome / Chromium)

The composer uses `puppeteer-core` and a local browser. Three options:

- **Auto-detect** (default): leave `CHROME_EXECUTABLE_PATH` blank. Standard
  paths are tried on Windows / macOS / Linux.
- **Explicit**: set `CHROME_EXECUTABLE_PATH=/full/path/to/chrome`.
- **Docker**: the Dockerfile installs `chromium` and pre-sets
  `CHROME_EXECUTABLE_PATH=/usr/bin/chromium`.

---

## 5. Local run

```bash
cp .env.example .env       # already populated for this project — review
npm install
npm run build
npm run seed:themes        # confirm themes + system templates loaded
npm run test:pipeline      # produce one carousel for the demo org
npm start                  # boot the HTTP API + workers
curl -s localhost:8090/health
```

---

## 6. Hetzner VPS deployment

### 6.1 Provision

Hetzner Cloud CX22 (2 vCPU / 4 GB RAM) is plenty — most work is API/HTML/PNG.

```bash
ssh root@YOUR_SERVER_IP
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 6.2 Deploy

```bash
mkdir -p /opt/content-engine && cd /opt/content-engine
# copy the project here (git clone / scp), then:
cp .env.example .env && nano .env
docker compose up -d --build
docker compose logs -f app
```

### 6.3 Reverse proxy + HTTPS (Caddy)

```
content-engine.yourdomain.com {
    reverse_proxy localhost:8090
}
n8n.yourdomain.com {
    reverse_proxy localhost:5679
}
```

```bash
apt install -y caddy
cp Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy
```

Point DNS A records at the server. The content engine `/api/*` is now
TLS-protected; tenants authenticate per-request with their `x-org-api-key`.

---

## 7. Production strategy

| Concern         | Recommendation                                                              |
| --------------- | --------------------------------------------------------------------------- |
| Process model   | `restart: unless-stopped` (set) + Docker healthcheck on `/health`.          |
| Secrets         | `.env` is gitignored; for teams use Docker secrets / a vault.               |
| Encryption      | IG access tokens are stored plaintext in `instagram_accounts` for now —     |
|                 | wrap with `pgcrypto` (`pgp_sym_encrypt`) or KMS before going to prod.       |
| Backups         | Enable Supabase Point-in-Time Recovery.                                     |
| Observability   | JSON logs in prod → ship to Loki/Datadog. `usage_logs` powers per-tenant ROI.|
| Alerting        | Replace the n8n `ALERT — Failed` NoOp with a Slack/Telegram/Email node.     |
| Token refresh   | IG long-lived tokens expire (~60d). Add a monthly refresh job (roadmap).    |
| Scaling out     | Stateless service → run replicas behind a load balancer. The DB-backed       |
|                 | queue + atomic claim keep concurrent workers safe.                          |
| Queue upgrade   | Swap DB queue for Redis+BullMQ once volume exceeds a few hundred/day.       |
| Render scaling  | Move Puppeteer to a dedicated worker container if it competes with the API. |
| Cost guard      | Keep `IMAGE_PROVIDER=none`; monitor `usage_logs` per org per month.         |

---

## 8. Go-live checklist

- [ ] `db/schema.sql` + `db/seed.sql` executed.
- [ ] `.env` filled; `INTERNAL_API_KEY` is long + random.
- [ ] At least one `organizations` row with a unique `api_key`.
- [ ] Brand profile + Instagram account configured for that org.
- [ ] `npm run test:pipeline` produced `status: "completed"` with image URLs.
- [ ] A test reel published via `/api/ops/queue/process-publish`.
- [ ] n8n workflow imported, env vars set, **activated**.
- [ ] n8n failure branch wired to a real alerting channel.
- [ ] HTTPS in place; ports 8090/5679 not publicly exposed.
- [ ] Backups + uptime monitor.
