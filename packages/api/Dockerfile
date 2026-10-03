FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile --filter @qubo/api...

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/api ./packages/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared

EXPOSE 3333
ENV PORT=3333

# Bun runs the TypeScript entrypoint directly; there is no build step.
CMD ["bun", "packages/api/src/server.ts"]
