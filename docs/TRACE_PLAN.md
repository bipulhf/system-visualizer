# Request Tracer — Implementation Plan

## Goal
Watch a single request travel through the entire service chain (Elysia → Redis → BullMQ → RabbitMQ → Kafka → Postgres) step-by-step, controlled by Prev / Next clicks. Ends with a full post-mortem.

---

## How It Works

The server runs one isolated request through the real pipeline using actual services. It collects every `SimulationEvent` emitted for that `requestId` (including async ones from BullMQ workers and RabbitMQ consumers), then returns them as an ordered array. The frontend plays them back one step at a time.

---

## Phases

### Phase 1 — Server: Trace Capture ✅ COMPLETED
**Files**:
- `apps/server/src/events/types.ts` — add `TraceStep`, `TraceResult` types
- `apps/server/src/events/emitter.ts` — add `captureTraceEvents(requestId, runner, timeoutMs)` utility
- `apps/server/src/scenarios/trace-runner.ts` — new file: standalone single-request pipeline that runs elysia → redis → bullmq → rabbitmq → kafka → postgres with a unique requestId
- `apps/server/src/index.ts` — add `GET /simulation/trace` endpoint that calls the runner + capture and returns `TraceResult`

**Capture mechanism**:
- Subscribe to the global event bus before running
- Filter events by `requestId` (stored in `event.data.requestId`)
- After the sync chain completes, wait 2.5 s for async BullMQ / RabbitMQ events
- Unsubscribe and return sorted events

**Response shape**:
```ts
TraceResult {
  requestId: string
  steps: TraceStep[]      // ordered SimulationEvent + stepIndex + cumulativeLatencyMs
  totalLatencyMs: number
  startedAt: number
}
```

---

### Phase 2 — Frontend Route `/trace` ✅ COMPLETED
**Files**:
- `apps/web/src/routes/trace/index.tsx` — new route with full trace UI
- `apps/web/src/components/trace/step-card.tsx` — current step detail panel
- `apps/web/src/components/trace/trace-timeline.tsx` — horizontal dot-progress + mini step list
- `apps/web/src/components/trace/post-mortem.tsx` — latency breakdown per service with bar chart
- `apps/web/src/lib/trace-types.ts` — shared types matching server response

---

### Phase 3 — Top Navigation Link ✅ COMPLETED
**Files**:
- `apps/web/src/components/layout/top-nav.tsx` — add "Trace" link (Telescope icon or similar)

---

### Phase 4 — Flow Canvas Integration ✅ COMPLETED
Reuse the existing `FlowCanvas` + `ServiceNode` components. Add an `activeEdge?: { source: ServiceName; target: ServiceName }` prop so the current step's source→target edge glows/pulses.

**Files**:
- `apps/web/src/components/flow/flow-canvas.tsx` — accept `activeEdge` prop, pass to edges
- `apps/web/src/components/flow/service-edge.tsx` — new: custom animated edge that pulses when active

---

### Phase 5 — Post-Mortem Panel ✅ COMPLETED
After the last step (or via a "View Post-Mortem" button):
- Total journey time
- Per-service cumulative latency bar (recharts or plain CSS bars)
- Slowest service highlighted as "Bottleneck"
- "Run Another Trace" button

---

## UI Sketch

```
┌── /trace ─────────────────────────────────────────────────────────┐
│  Request Tracer                              [▷ Run New Trace]     │
│                                                                     │
│  [Service flow canvas — active edge glows]                         │
│                                                                     │
│  ┌─ Step 4 / 18 ──────────────────────── [← Prev]  [Next →] ─┐   │
│  │  bullmq → rabbitmq   bullmq.job.created               5ms  │   │
│  │                                                             │   │
│  │  BullMQ enqueued job job-42 for req-trace-abc              │   │
│  │  shouldFail: false · priority: 1 · cumulative: 23ms        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ● ● ● ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○   4 / 18                   │
└─────────────────────────────────────────────────────────────────────┘
```

Post-mortem (at last step):
```
┌── Post-Mortem ─────────────────────────────────────────────────────┐
│  18 steps · Total: 847ms                                           │
│                                                                     │
│  BullMQ    ████████████░░░░░░░░  287ms  34%  ← bottleneck         │
│  RabbitMQ  ██████░░░░░░░░░░░░░░  156ms  18%                       │
│  Postgres  ████░░░░░░░░░░░░░░░░   89ms  11%                       │
│  Redis     ██░░░░░░░░░░░░░░░░░░   23ms   3%                       │
│  Kafka     █░░░░░░░░░░░░░░░░░░░   12ms   1%                       │
│  Elysia    ░░░░░░░░░░░░░░░░░░░░    5ms  <1%                       │
│                                                                     │
│  [← Back to steps]   [▷ Run Another Trace]                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Status: ALL PHASES COMPLETE ✅
