# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.11 AS builder
WORKDIR /app

ARG VITE_SIMULATION_WS_URL=/ws/simulation
ENV VITE_SIMULATION_WS_URL=$VITE_SIMULATION_WS_URL

COPY package.json bun.lock tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile

COPY apps/web apps/web
COPY packages/shared packages/shared

RUN bun --filter @visualizer/shared build
RUN bun --filter @visualizer/web build

FROM oven/bun:1.3.11 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.output ./.output

EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
