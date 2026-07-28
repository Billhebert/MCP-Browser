FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npx tsc

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium chromium-sandbox libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

ENV BROWSER_HEADLESS=true
ENV NODE_ENV=production
ENV BVP_AUDIT_DIR=/data/audit
ENV BVP_RATE_LIMIT=120

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3100 9090
VOLUME ["/data", "/home/bvp-user/.bvp-browser-profile"]
ENV HOME=/home/bvp-user
RUN useradd -m bvp-user && chown -R bvp-user:bvp-user /app /data /home/bvp-user
USER bvp-user

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/health').then(r => process.exit(r.ok?0:1)).catch(() => process.exit(1))"

ENTRYPOINT ["node", "dist/index.js"]