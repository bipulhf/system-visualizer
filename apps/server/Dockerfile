# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.11 AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile

COPY apps/server apps/server
COPY packages/shared packages/shared

RUN bun --filter @visualizer/shared build
RUN bun --filter @visualizer/server build

FROM oven/bun:1.3.11 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/bun.lock /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/shared ./packages/shared

EXPOSE 3001
CMD ["bun", "apps/server/dist/index.js"]
