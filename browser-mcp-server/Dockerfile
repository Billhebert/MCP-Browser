FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  chromium-sandbox \
  libnss3 \
  libnspr4 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

ENV BROWSER_HEADLESS=true
ENV BVP_AUDIT_DIR=/data/audit
ENV BVP_RATE_LIMIT=120
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install chromium 2>/dev/null || true

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc --noEmit 2>/dev/null || true

EXPOSE 3100

VOLUME ["/data", "/home/bvp-user/.bvp-browser-profile"]

ENV HOME=/home/bvp-user
RUN useradd -m bvp-user && chown -R bvp-user:bvp-user /app /data /home/bvp-user
USER bvp-user

ENTRYPOINT ["npx", "tsx", "src/index.ts"]
