# System Visualizer — Development Plan

> An interactive learning platform that teaches distributed systems concepts through animated, real-time visualizations of realistic backend scenarios.

---

## Tech Stack & Versions

### Frontend (Visualization App)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| Runtime | `bun` | 1.3.11 | JS runtime & package manager |
| Framework | `@tanstack/start` | ^1.120.x | Full-stack React framework (SSR, routing, server functions) |
| Router | `@tanstack/react-router` | ^1.168.x | Type-safe file-based routing |
| React | `react` / `react-dom` | ^19.2.x | UI library |
| Styling | `tailwindcss` | ^4.2.x | Utility-first CSS |
| UI Components | `shadcn` (CLI 4.x) | copy-paste | Base component primitives (Radix UI under the hood) |
| UI Theme | Neobrutalism | CSS override | Bold borders, hard shadows, vibrant colors (from neobrutalism.dev) |
| Animation | `motion` | ^12.38.x | Spring/keyframe animations for data flow |
| Flow Diagrams | `@xyflow/react` | ^12.10.x | Node/edge graph rendering for architecture diagrams |
| Charts | `recharts` or shadcn charts | latest | Queue depth, throughput, latency metrics |
| Icons | `lucide-react` | latest | Consistent iconography |

### Backend (Simulation Engine)

| Technology | Package | Version | Purpose |
|---|---|---|---|
| HTTP Server | `elysia` | ^1.4.x | High-perf Bun-native HTTP server |
| Redis | `ioredis` | ^5.10.x | Atomic ops, caching, geo, pub/sub |
| Job Queue | `bullmq` | ^5.71.x | Job scheduling, retries, DLQ, parent/child flows |
| Message Broker | `amqplib` | ^1.0.x | RabbitMQ fan-out, competing consumers, publisher confirms |
| Event Streaming | `kafkajs` | ^2.2.x | Immutable event log, consumer groups |
| Database | `postgres` (postgres.js) | ^3.4.x | PostgreSQL client |
| ORM | `drizzle-orm` | ^0.45.x | Type-safe SQL queries & migrations |
| WebSocket | `elysia` built-in WS | — | Real-time event push to frontend |

### Infrastructure (Local Dev)

| Technology | Version | Purpose |
|---|---|---|
| Docker Engine | 29.x | Container runtime |
| Docker Compose | 2.35.x | Multi-service orchestration |
| PostgreSQL | 17 | Relational database |
| Redis | 7.4 | In-memory data store |
| RabbitMQ | 4.1 (management) | Message broker with management UI |
| Apache Kafka + Zookeeper | Kafka 3.9 / KRaft | Event streaming platform |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (TanStack Start)                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Scenario  │  │  Flow Graph  │  │  Activity Monitor +   │ │
│  │ Selector  │  │ (@xyflow)    │  │  Event Log            │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
│                         │ WebSocket                          │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│              Backend (Elysia.js on Bun)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Scenario  │  │ Sim      │  │ Event    │  │ WS         │  │
│  │ Controller│  │ Engine   │  │ Collector│  │ Broadcaster│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│        │             │             │              │           │
│  ┌─────┴─────────────┴─────────────┴──────────────┘          │
│  │                                                           │
│  ▼         ▼            ▼              ▼          ▼          │
│ Redis    BullMQ      RabbitMQ       Kafka    PostgreSQL      │
└─────────────────────────────────────────────────────────────┘
```

**How it works:**

1. User picks a scenario on the frontend
2. Frontend opens a WebSocket to the backend
3. Backend runs the scenario simulation against real infrastructure (Redis, BullMQ, RabbitMQ, Kafka, PostgreSQL)
4. Every operation emits a structured event via WebSocket to the frontend
5. Frontend renders the event as an animation on the flow graph + appends it to the event log

The backend is NOT a mock — it runs real Redis DECR, real BullMQ jobs, real RabbitMQ exchanges, real Kafka topics. The visualization shows what is actually happening.

---

## Neobrutalism UI Theme

The UI follows the neobrutalism design language applied on top of shadcn/ui:

### Design Tokens (CSS Custom Properties)

```css
:root {
  /* Core neobrutalism tokens */
  --border: oklch(0% 0 0);              /* Pure black borders */
  --box-shadow-x: 4px;
  --box-shadow-y: 4px;
  --shadow: var(--box-shadow-x) var(--box-shadow-y) 0px 0px var(--border);

  /* Vibrant palette — one accent color per service */
  --main: oklch(67.47% .1725 259.61);   /* Blue — API/Elysia */
  --redis: oklch(62% .25 29);           /* Red — Redis */
  --bullmq: oklch(75% .18 85);          /* Yellow — BullMQ */
  --rabbitmq: oklch(65% .2 145);        /* Green — RabbitMQ */
  --kafka: oklch(55% .15 300);          /* Purple — Kafka */
  --postgres: oklch(60% .15 230);       /* Steel Blue — PostgreSQL */

  --background: oklch(96% .01 90);      /* Off-white/cream */
  --foreground: oklch(0% 0 0);          /* Black text */
}
```

### Key Visual Rules

- **All interactive elements**: `border-2 border-black` + hard offset shadow (`4px 4px 0 0 black`)
- **Hover/press effect**: Element translates by shadow offset, shadow disappears (button "presses in")
- **Service nodes in flow graph**: Each service gets its own bold color (see palette above)
- **Font**: DM Sans — `font-heading` (700) for titles, `font-base` (400) for body
- **Dark mode**: Supported via CSS variables swap (oklch dark variants)

---

## UI Layout & UX Design

### Global Layout

```
┌──────────────────────────────────────────────────────────┐
│  Logo    Scenario Tabs    [Theme Toggle]   [Speed Ctrl]  │  <- Top Nav
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ Sidebar (collapsible) ─────────────────────────────┐ │
│  │                                                     │ │
│  │  Scenario Info                                      │ │
│  │  - Title & tagline                                  │ │
│  │  - "The Problem" card                               │ │
│  │  - Phase timeline (vertical stepper)                │ │
│  │                                                     │ │
│  │  Learning Panel                                     │ │
│  │  - "Why this tech?" expandable cards                │ │
│  │  - Key concept callouts                             │ │
│  │  - "What would go wrong without this?" toggle       │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Main Canvas ───────────────────────────────────────┐ │
│  │                                                     │ │
│  │  Architecture Flow Graph (@xyflow)                  │ │
│  │  - Service nodes with status indicators             │ │
│  │  - Animated edges showing data flow                 │ │
│  │  - Message count badges on edges                    │ │
│  │  - Particle animations for in-flight messages       │ │
│  │                                                     │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │                                                     │ │
│  │  Activity Monitor Bar (horizontal)                  │ │
│  │  - Per-service mini cards: throughput, queue depth,  │ │
│  │    processing time, retry count                     │ │
│  │                                                     │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │                                                     │ │
│  │  Event Log (scrolling feed)                         │ │
│  │  - Timestamped entries with service color coding    │ │
│  │  - Expandable detail view per event                 │ │
│  │  - Filter by service / event type                   │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Learning-First UX Features

1. **"Why This Tech?" Tooltips** — Hovering any service node shows a card explaining why this specific technology was chosen (not another) with a concrete comparison (e.g., "Redis DECR is atomic in <1ms. A PostgreSQL UPDATE with row-lock would take ~15ms and deadlock under 10k concurrent requests.")

2. **Phase Stepper** — Left sidebar shows a vertical stepper for the current scenario's phases. Each phase highlights which services activate. Users can click a phase to jump to it or let it auto-advance.

3. **"What If?" Mode** — A toggle that shows what happens when a technology is removed or replaced with a naive approach. Example: Remove Redis from the flash sale → show the database getting overwhelmed with a visual "explosion" animation and counter showing oversold items.

4. **Concept Cards** — Floating cards that appear contextually during the animation explaining concepts like "Atomic Operation", "Dead Letter Queue", "Competing Consumers", "Fan-Out Pattern", "Idempotency", etc.

5. **Speed Control** — Playback speed slider (0.25x to 4x) + pause/step-through mode for studying individual events.

6. **Event Log with "Learn More"** — Each event in the log has an expandable section that explains what just happened in plain language and links the concept to the relevant technology.

7. **Scenario Comparison View** — After completing a scenario, a summary card shows: which tech handled what, message counts, latencies, and a "What you learned" checklist.

---

## Project Structure

```
visualizer/
├── docker-compose.yml              # Redis, PostgreSQL, RabbitMQ, Kafka
├── package.json                    # Workspace root (Bun workspaces)
├── bun.lock
├── turbo.json                      # (optional) Turborepo for monorepo tasks
│
├── apps/
│   ├── web/                        # TanStack Start frontend
│   │   ├── app/
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx      # Root layout (nav, sidebar, theme)
│   │   │   │   ├── index.tsx       # Landing / scenario selector
│   │   │   │   ├── scenarios/
│   │   │   │   │   ├── flash-sale.tsx
│   │   │   │   │   ├── ride-sharing.tsx
│   │   │   │   │   ├── video-pipeline.tsx
│   │   │   │   │   └── banking.tsx
│   │   │   │   └── learn/
│   │   │   │       ├── index.tsx           # Concepts glossary
│   │   │   │       └── $concept.tsx        # Individual concept page
│   │   │   ├── components/
│   │   │   │   ├── ui/                     # shadcn + neobrutalism overrides
│   │   │   │   ├── flow/
│   │   │   │   │   ├── service-node.tsx    # Custom @xyflow node per service
│   │   │   │   │   ├── animated-edge.tsx   # Particle animation edge
│   │   │   │   │   ├── flow-canvas.tsx     # @xyflow wrapper
│   │   │   │   │   └── message-badge.tsx   # Count badge on edges
│   │   │   │   ├── learning/
│   │   │   │   │   ├── why-tooltip.tsx     # "Why this tech?" hover card
│   │   │   │   │   ├── concept-card.tsx    # Floating concept explainer
│   │   │   │   │   ├── phase-stepper.tsx   # Vertical phase timeline
│   │   │   │   │   ├── what-if-toggle.tsx  # "What if?" failure mode
│   │   │   │   │   └── summary-card.tsx    # Post-scenario learning recap
│   │   │   │   ├── monitor/
│   │   │   │   │   ├── activity-bar.tsx    # Horizontal service metrics
│   │   │   │   │   ├── service-card.tsx    # Per-service stats mini card
│   │   │   │   │   └── metric-chart.tsx    # Mini sparkline/bar chart
│   │   │   │   ├── event-log/
│   │   │   │   │   ├── event-feed.tsx      # Scrolling log
│   │   │   │   │   ├── event-entry.tsx     # Single log entry
│   │   │   │   │   └── log-filters.tsx     # Service/type filter bar
│   │   │   │   ├── controls/
│   │   │   │   │   ├── speed-slider.tsx    # Playback speed control
│   │   │   │   │   └── scenario-tabs.tsx   # Top nav scenario switcher
│   │   │   │   └── layout/
│   │   │   │       ├── sidebar.tsx
│   │   │   │       ├── top-nav.tsx
│   │   │   │       └── theme-toggle.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-simulation.ts       # WebSocket connection + state
│   │   │   │   ├── use-flow-state.ts       # @xyflow node/edge state mgmt
│   │   │   │   └── use-playback.ts         # Speed, pause, step controls
│   │   │   ├── lib/
│   │   │   │   ├── ws-client.ts            # WebSocket wrapper
│   │   │   │   ├── event-types.ts          # Shared event type definitions
│   │   │   │   ├── scenario-configs.ts     # Static config for each scenario
│   │   │   │   └── learning-content.ts     # All educational text/tooltips
│   │   │   └── styles/
│   │   │       └── globals.css             # Neobrutalism CSS tokens + Tailwind
│   │   ├── app.config.ts                   # TanStack Start config
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── server/                     # Elysia.js backend
│       ├── src/
│       │   ├── index.ts            # Elysia app entry, WS setup
│       │   ├── scenarios/
│       │   │   ├── flash-sale.ts   # Scenario 1 simulation logic
│       │   │   ├── ride-sharing.ts # Scenario 2 simulation logic
│       │   │   ├── video-pipeline.ts
│       │   │   └── banking.ts
│       │   ├── services/
│       │   │   ├── redis.ts        # Redis client + helper ops
│       │   │   ├── bullmq.ts       # BullMQ queue/worker setup
│       │   │   ├── rabbitmq.ts     # RabbitMQ connection, exchanges, queues
│       │   │   ├── kafka.ts        # Kafka producer/consumer setup
│       │   │   └── postgres.ts     # Drizzle + postgres.js setup
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle schema definitions
│       │   │   └── migrations/     # Drizzle migrations
│       │   ├── events/
│       │   │   ├── emitter.ts      # Central event bus (EventEmitter)
│       │   │   └── types.ts        # Event type definitions (shared w/ frontend)
│       │   └── utils/
│       │       └── logger.ts       # Structured logging
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                     # Shared types & constants
│       ├── src/
│       │   ├── events.ts           # Event type definitions
│       │   ├── scenarios.ts        # Scenario metadata types
│       │   └── services.ts         # Service name constants + colors
│       ├── tsconfig.json
│       └── package.json
│
├── IDEA.md
├── PLAN.md
└── README.md
```

---

## Simulation Event Protocol

All communication between backend and frontend uses a structured WebSocket event protocol:

```typescript
// packages/shared/src/events.ts

type ServiceName = "elysia" | "redis" | "bullmq" | "rabbitmq" | "kafka" | "postgres";

type EventKind =
  | "request.received"      // HTTP request hit the API
  | "request.rejected"      // Rate limited, duplicate, etc.
  | "redis.op"              // DECR, SET, GET, GEORADIUS, etc.
  | "bullmq.job.created"    // Job added to queue
  | "bullmq.job.processing" // Worker picked up job
  | "bullmq.job.completed"  // Job finished
  | "bullmq.job.failed"     // Job failed (with retry info)
  | "bullmq.job.dlq"        // Job moved to dead letter queue
  | "bullmq.job.progress"   // Job progress update (0-100)
  | "rabbitmq.published"    // Message published to exchange
  | "rabbitmq.routed"       // Message routed to queue
  | "rabbitmq.consumed"     // Consumer processed message
  | "rabbitmq.ack"          // Consumer acknowledged
  | "kafka.produced"        // Event published to topic
  | "kafka.consumed"        // Consumer group read event
  | "postgres.query"        // SQL query executed
  | "postgres.tx.begin"     // Transaction started
  | "postgres.tx.commit"    // Transaction committed
  | "phase.change"          // Scenario phase transition
  | "scenario.complete";    // Scenario finished

interface SimulationEvent {
  id: string;                // Unique event ID
  timestamp: number;         // Unix ms
  scenario: string;          // "flash-sale" | "ride-sharing" | etc.
  phase: number;             // Current phase (1-5)
  kind: EventKind;
  source: ServiceName;       // Which service emitted this
  target?: ServiceName;      // Where data is flowing to (for edge animation)
  data: Record<string, unknown>; // Event-specific payload
  latencyMs: number;         // How long this operation took
  description: string;       // Human-readable explanation
  learnMore?: string;        // Educational context (shown in event log expand)
}
```

---

## Development Phases

### Phase 0: Project Bootstrap (Days 1-2)

**Goal:** Working monorepo with all infrastructure running locally.

- [ ] Initialize Bun workspace monorepo (`apps/web`, `apps/server`, `packages/shared`)
- [ ] Set up TanStack Start app with file-based routing
- [ ] Set up Elysia.js server with basic health check endpoint
- [ ] Set up shared types package
- [ ] Create `docker-compose.yml` with all services:
  - PostgreSQL 17
  - Redis 7.4
  - RabbitMQ 4.1 (with management plugin on :15672)
  - Kafka 3.9 (KRaft mode, no Zookeeper)
- [ ] Verify all services connect from Elysia.js
- [ ] Initialize shadcn/ui with Tailwind v4
- [ ] Apply neobrutalism CSS overrides (global tokens, border/shadow utilities)
- [ ] Install DM Sans font
- [ ] Set up dark mode toggle with CSS variable swap
- [ ] Create base layout components (top-nav, sidebar shell, main canvas area)

**Deliverable:** Monorepo boots, `docker compose up` runs all infra, frontend shows styled skeleton layout, backend connects to all services.

---

### Phase 1: Flow Graph Engine + WebSocket (Days 3-6)

**Goal:** Animated architecture diagram that responds to real-time events.

#### Backend
- [ ] Implement WebSocket endpoint in Elysia.js (`/ws/simulation`)
- [ ] Create central `EventEmitter` that all service wrappers emit through
- [ ] Wire EventEmitter → WebSocket broadcast
- [ ] Create service wrapper modules:
  - `redis.ts` — wraps ioredis, emits events on every operation
  - `bullmq.ts` — wraps queue/worker creation, emits on job lifecycle
  - `rabbitmq.ts` — wraps channel ops, emits on publish/consume/ack
  - `kafka.ts` — wraps producer/consumer, emits on produce/consume
  - `postgres.ts` — wraps drizzle queries, emits on query/transaction

#### Frontend
- [ ] Build `use-simulation` hook (WebSocket connect, reconnect, message parsing)
- [ ] Build `flow-canvas.tsx` with @xyflow/react
- [ ] Create custom `service-node.tsx` — neobrutalism styled node per service with:
  - Service icon + name
  - Status indicator (idle/active/error) with color pulse
  - Mini stats (ops/sec, queue depth)
- [ ] Create `animated-edge.tsx` — edges with:
  - Particle dots flowing along the path when data moves
  - Message count badge
  - Color matches source service
- [ ] Build `use-flow-state` hook — maps incoming WebSocket events to @xyflow node/edge state updates
- [ ] Implement edge animation using motion library (particles along SVG path)

**Deliverable:** Connect to backend via WS, see service nodes light up and edges animate when events flow. No scenario logic yet — just a test harness that pushes sample events.

---

### Phase 2: Learning UI Components (Days 7-10)

**Goal:** All educational UX components built and wired up.

- [ ] **Phase Stepper** (`phase-stepper.tsx`)
  - Vertical timeline in sidebar
  - Steps: number + title + short description
  - Current phase highlighted with animation
  - Click to jump to phase (sends command to backend)
  - Auto-advances as simulation progresses

- [ ] **"Why This Tech?" Tooltip** (`why-tooltip.tsx`)
  - Hover/click a service node → shadcn HoverCard pops up
  - Content: "Why [tech]?", comparison with naive alternative, key metric
  - Neobrutalism styled card with service accent color border

- [ ] **Concept Cards** (`concept-card.tsx`)
  - Triggered by specific events (e.g., first DLQ event → "Dead Letter Queue" card)
  - Animated slide-in from right
  - Title, 2-3 sentence explanation, small diagram/icon
  - Dismiss or auto-hide after 8s
  - Never show the same concept twice per session

- [ ] **"What If?" Toggle** (`what-if-toggle.tsx`)
  - Toggle switch per scenario: "What if we didn't use [tech]?"
  - Activates failure mode visualization:
    - Node turns red with shake animation
    - Counter shows failures (oversold items, lost messages, etc.)
    - Brief explanation of what went wrong

- [ ] **Event Log** (`event-feed.tsx`)
  - Scrolling feed with newest on top
  - Each entry: timestamp, service color dot, description
  - Expandable: shows raw data, latency, and "Learn More" text
  - Filter buttons by service (toggle pills with service colors)

- [ ] **Activity Monitor** (`activity-bar.tsx`)
  - Horizontal bar below flow graph
  - One mini card per active service showing:
    - Operations/sec (live counter)
    - Queue depth (for BullMQ/RabbitMQ)
    - Average latency
    - Error/retry count
  - Sparkline charts for throughput over time

- [ ] **Speed Control** (`speed-slider.tsx`)
  - Slider: 0.25x, 0.5x, 1x, 2x, 4x
  - Pause button (freezes animation + event log, backend buffers events)
  - Step button (advance one event at a time when paused)

- [ ] **Learning Content Data** (`learning-content.ts`)
  - All tooltip text, concept card content, "what if" descriptions
  - Organized by scenario and service
  - Written in clear, jargon-light language

**Deliverable:** All learning UI components rendered with mock data. Interactive and styled with neobrutalism theme.

---

### Phase 3: Scenario 1 — E-Commerce Flash Sale (Days 11-15)

**Goal:** First complete end-to-end scenario fully working.

#### Backend Simulation (`scenarios/flash-sale.ts`)
- [ ] Phase 1 — The Spike:
  - Simulate 10,000 requests hitting Elysia (configurable count)
  - Redis `DECR stock:item_42` — 100 succeed, rest rejected
  - Redis sliding window rate limiter
  - Emit events: `request.received`, `redis.op` (DECR), `request.rejected`

- [ ] Phase 2 — Job Queuing:
  - BullMQ queue with 100 prioritized jobs
  - Worker processes: payment → reserve_inventory → confirm
  - Failed payments retry 3x with exponential backoff
  - On final failure: release stock back via Redis INCR
  - Emit events: `bullmq.job.created`, `bullmq.job.processing`, `bullmq.job.completed`, `bullmq.job.failed`

- [ ] Phase 3 — Fan-Out:
  - RabbitMQ fanout exchange → 4 queues (email, invoice, warehouse, fraud)
  - Each consumer processes and ACKs
  - Emit events: `rabbitmq.published`, `rabbitmq.routed`, `rabbitmq.consumed`, `rabbitmq.ack`

- [ ] Phase 4 — Audit Trail:
  - Kafka producer sends all 10k events to `flash-sale-events` topic
  - 3 consumer groups read at different speeds
  - Emit events: `kafka.produced`, `kafka.consumed`

- [ ] PostgreSQL final write on successful orders
  - Emit events: `postgres.tx.begin`, `postgres.query`, `postgres.tx.commit`

#### Frontend Integration
- [ ] Wire flash-sale route to simulation hook
- [ ] Configure @xyflow graph layout for this scenario's architecture
- [ ] Map all event kinds to node/edge animations
- [ ] Write all learning content for flash sale:
  - Why Redis for atomic stock counting (vs DB locks)
  - Why BullMQ for retry logic (vs manual retries)
  - Why RabbitMQ fan-out (vs sequential calls)
  - Why Kafka for audit (vs writing to DB)
  - "What if?" content for each service removal
- [ ] Phase stepper configured with 4 phases
- [ ] Concept cards triggered: "Atomic Operation", "Thundering Herd", "Fan-Out Pattern", "Dead Letter Queue", "Event Sourcing"

#### Testing & Polish
- [ ] End-to-end run: start simulation, watch all 4 phases animate
- [ ] Verify event log shows correct flow
- [ ] Verify activity monitor shows real metrics
- [ ] Tune animation timing for clarity at 1x speed

**Deliverable:** Complete working Scenario 1 — user clicks "Start", watches the entire flash sale play out with full learning UI.

---

### Phase 4: Scenario 2 — Ride-Sharing Live Dispatch (Days 16-19)

#### Backend Simulation (`scenarios/ride-sharing.ts`)
- [ ] Phase 1 — Driver Heartbeat:
  - Simulate N drivers sending GPS coords every 2s
  - Redis `GEOADD` + 30s TTL per driver
  - Redis Pub/Sub broadcasts location updates
  - Emit events for each heartbeat + geo update

- [ ] Phase 2 — Ride Request:
  - Passenger request → Redis `GEORADIUS` for nearest 5 drivers
  - BullMQ job with 30s timeout (delayed retry with wider radius)
  - Emit events for geo query + job creation

- [ ] Phase 3 — Driver Acceptance:
  - RabbitMQ direct exchange → competing consumers pattern
  - Only ONE consumer processes (show others idle)
  - Emit events showing single-consumer selection

- [ ] Phase 4 — Trip Lifecycle:
  - Kafka topic `trip-events` with state transitions
  - Multiple consumer groups at different speeds
  - PostgreSQL write only at trip completion

#### Frontend Integration
- [ ] @xyflow layout for ride-sharing architecture
- [ ] Animated driver dots on a mini-map overlay (or abstract representation)
- [ ] BullMQ timeout countdown visualization
- [ ] RabbitMQ competing consumers — visual showing only 1 worker activates
- [ ] Learning content: Redis Geo, delayed jobs, competing vs fan-out, event state machine
- [ ] Concept cards: "Competing Consumers", "Geo Hashing", "TTL Auto-Expiry", "State Machine"

**Deliverable:** Complete Scenario 2 with all learning features.

---

### Phase 5: Scenario 3 — Video Transcoding Pipeline (Days 20-23)

#### Backend Simulation (`scenarios/video-pipeline.ts`)
- [ ] Phase 1 — Upload intake, PostgreSQL insert, BullMQ parent job with 5 children
- [ ] Phase 2 — Workers process child jobs with progress reporting (0-100%)
  - Redis stores live progress per job with TTL
- [ ] Phase 3 — Failure handling: one child fails 3x → DLQ
  - Other children continue independently
- [ ] Phase 4 — RabbitMQ routes completion to CDN/search/notification (routing keys)
  - Kafka `video.published` event to consumer groups
- [ ] Phase 5 — PostgreSQL final update, Redis TTL cleanup

#### Frontend Integration
- [ ] @xyflow layout with parent/child job tree visualization
- [ ] Progress bars on each child job node (animated 0→100%)
- [ ] DLQ visualization — failed job moves to separate "graveyard" node
- [ ] RabbitMQ routing keys visualized as labeled arrows
- [ ] Kafka consumers processing at visibly different speeds
- [ ] Learning content: parent/child flows, DLQ, progress tracking, routing keys, TTL cleanup
- [ ] Concept cards: "Parent/Child Jobs", "Dead Letter Queue", "Routing Keys", "Partial Availability"

**Deliverable:** Complete Scenario 3 with all learning features.

---

### Phase 6: Scenario 4 — Banking Transaction Ledger (Days 24-27)

#### Backend Simulation (`scenarios/banking.ts`)
- [ ] Phase 1 — Redis rate limit, idempotency check, account lock
- [ ] Phase 2 — PostgreSQL SERIALIZABLE transaction (debit, credit, ledger entry)
  - Redis idempotency record with 24h TTL
- [ ] Phase 3 — RabbitMQ with publisher confirms
  - Fraud detection with synchronous reply pattern
  - BullMQ delayed review job if fraud hold
- [ ] Phase 4 — Kafka with replication factor 3 visualization
  - Multiple consumer groups
- [ ] Phase 5 — Audit query reads from PostgreSQL + Kafka backup

#### Frontend Integration
- [ ] @xyflow layout emphasizing data integrity flow
- [ ] Redis idempotency visualization — duplicate request bouncing off
- [ ] PostgreSQL transaction as a grouped atomic block (visual grouping)
- [ ] RabbitMQ publisher confirms — ACK arrows flowing back
- [ ] Kafka replication — data visually written to 3 nodes
- [ ] BullMQ delayed job with countdown timer
- [ ] Learning content: idempotency, SERIALIZABLE isolation, publisher confirms, replication, audit trails
- [ ] Concept cards: "Idempotency", "ACID Transactions", "Publisher Confirms", "Replication Factor", "Immutable Log"

**Deliverable:** Complete Scenario 4 with all learning features.

---

### Phase 7: Landing Page, Learn Section & Polish (Days 28-32)

#### Landing Page (`routes/index.tsx`)
- [ ] Hero section: bold neobrutalism typography, tagline, animated preview
- [ ] 4 scenario cards with preview thumbnails and difficulty tags
- [ ] "What you'll learn" section — grid of technology icons with one-liner descriptions
- [ ] Quick-start CTA → jumps to Scenario 1

#### Learn Section (`routes/learn/`)
- [ ] Concepts glossary page — all concepts from all scenarios in a searchable grid
- [ ] Individual concept pages with:
  - Clear definition
  - Which scenarios use this concept
  - Visual diagram
  - "See it in action" link → jumps to the relevant scenario + phase

#### Scenario Comparison View
- [ ] Post-scenario summary card:
  - Technologies used and their roles
  - Total events processed, messages routed, jobs completed
  - Latency breakdown per service
  - "What you learned" checklist (concepts encountered)
- [ ] Cross-scenario comparison: "Redis in Flash Sale vs Banking" — same tech, different purpose

#### Polish
- [ ] Responsive layout (desktop-first, tablet-friendly)
- [ ] Keyboard shortcuts (Space = pause, Arrow keys = step, 1-4 = speed presets)
- [ ] Loading states with neobrutalism skeleton animations
- [ ] Error states (backend disconnected, service down)
- [ ] Smooth transitions between scenarios
- [ ] Performance optimization: virtualized event log, throttled @xyflow updates
- [ ] Accessibility: focus indicators, ARIA labels on interactive elements, reduced motion support

**Deliverable:** Polished, complete application ready for deployment.

---

### Phase 8: Deployment & Documentation (Days 33-35)

- [ ] Production Docker Compose with all services
- [ ] Frontend build optimization (SSR for landing/learn pages, CSR for simulation)
- [ ] Environment variable configuration
- [ ] README with setup instructions, architecture diagram, screenshots
- [ ] Optional: Deploy to a VPS with Caddy reverse proxy
- [ ] Optional: Record a demo video/GIF for README

---

## Key Design Decisions

### Why TanStack Start over Next.js?
- Type-safe routing with zero runtime overhead
- File-based routing with full TypeScript inference
- Server functions for any SSR data needs (learn pages, concept content)
- Lighter framework, runs on Bun natively
- No React Server Components complexity for a primarily client-rendered app

### Why @xyflow/react over pure D3?
- Built-in node/edge management, pan/zoom, minimap
- Custom React components as nodes (service cards with state)
- Handles layout calculation and edge routing
- D3 would require building all graph interaction from scratch

### Why real infrastructure instead of mocking?
- The visualization is truthful — events come from actual Redis, BullMQ, RabbitMQ, Kafka operations
- Latency numbers are real, not fabricated
- Failure modes are genuine (DLQ happens because a real job really failed)
- Students see that these tools actually work this way, not just in theory

### Why separate event log + flow graph + activity monitor?
- Flow graph answers "where is data going?"
- Activity monitor answers "how busy is each service?"
- Event log answers "what exactly happened and why?"
- Three complementary views = complete understanding

### Why Bun throughout?
- Single runtime for frontend + backend
- Native TypeScript support without build step for server
- Fastest package manager
- Built-in test runner for integration tests
