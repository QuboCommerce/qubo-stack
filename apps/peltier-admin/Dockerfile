FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/peltier-admin/package.json ./apps/peltier-admin/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/peltier-admin/node_modules ./apps/peltier-admin/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter peltier-admin build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/peltier-admin/.next/standalone ./
COPY --from=builder /app/apps/peltier-admin/.next/static ./apps/peltier-admin/.next/static
COPY --from=builder /app/apps/peltier-admin/public ./apps/peltier-admin/public

USER nextjs
EXPOSE 4000
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/peltier-admin/server.js"]
