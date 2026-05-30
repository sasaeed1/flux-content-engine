# ---------- Build stage ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium (for puppeteer-core) + libraries Sharp depends on + curl for healthcheck.
# ca-certificates is CRITICAL — without it every TLS handshake (Supabase + every
# AI provider) silently fails. node:22-slim sometimes ships a stale/empty bundle.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      fonts-liberation \
      fonts-noto-color-emoji \
      libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 \
      curl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Also tell Node + axios to use the system CA bundle explicitly.
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8090/health || exit 1

CMD ["node", "dist/index.js"]
