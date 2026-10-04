FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Whole workspace, like the storefront: picking package.json files by hand
# breaks the install whenever a workspace dependency is added.
FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter qubo-admin...
# The DB client needs a URL at import; nothing connects during the build.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/build pnpm --filter qubo-admin build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/qubo-admin/.next/standalone ./
COPY --from=builder /app/apps/qubo-admin/.next/static ./apps/qubo-admin/.next/static
COPY --from=builder /app/apps/qubo-admin/public ./apps/qubo-admin/public

USER nextjs
EXPOSE 4000
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/qubo-admin/server.js"]
