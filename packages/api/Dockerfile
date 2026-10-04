FROM oven/bun:1-alpine AS base
WORKDIR /app

# Whole workspace: the API imports workspace packages as TypeScript source, so
# copying a hand-picked subset silently breaks whenever a dependency is added.
FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache nodejs npm && npm i -g pnpm@10.24.0
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter @qubo/api...

EXPOSE 3333
ENV PORT=3333

# Bun runs the TypeScript entrypoint directly; there is no build step.
CMD ["bun", "packages/api/src/server.ts"]
