# syntax=docker/dockerfile:1
# Production image for PPybasin (Next.js, standalone output).
# Build:  docker compose -f docker-compose.prod.yml build
# Run:    docker compose -f docker-compose.prod.yml up -d

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

# ---------- deps: install dependencies only (cached unless lockfile changes) ----------
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---------- builder: build the Next.js app ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Plain `next build` — runtime env (DB, NEXTAUTH_*, etc.) is injected by
# docker-compose via env_file, not baked into the image.
RUN yarn build

# ---------- runner: minimal production image ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone output: minimal server + only the deps it actually needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Writable dirs for uploads/storage; mounted as volumes in compose so data
# survives image rebuilds.
RUN mkdir -p ./public/uploads ./storage/files ./storage/slips \
 && chown -R nextjs:nodejs ./public/uploads ./storage

USER nextjs
EXPOSE 3010

CMD ["node", "server.js"]
