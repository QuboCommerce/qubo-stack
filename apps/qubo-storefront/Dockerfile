FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter qubo-storefront...
RUN pnpm --filter qubo-storefront build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/qubo-storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/qubo-storefront/.next/static ./apps/qubo-storefront/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/qubo-storefront/server.js"]
