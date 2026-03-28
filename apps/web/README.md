# @visualizer/web

Frontend application for System Visualizer, built with TanStack Start and TanStack Router.

## Scripts

```bash
bun run dev
bun run typecheck
bun run build
bun run start
```

## Notes

- Scenario routes are configured for client rendering (`ssr: false`) to keep the simulation runtime browser-driven.
- Landing and learn routes are SSR-enabled for faster first contentful paint and SEO-friendly HTML.
- WebSocket URL is configured via `VITE_SIMULATION_WS_URL` (see root `.env.example`).

See the workspace root [README.md](../../README.md) for full setup and deployment.
