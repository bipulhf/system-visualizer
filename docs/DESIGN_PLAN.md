# DESIGN_PLAN — Modern UI Redesign

## Current State: What Makes It Complicated

The existing UI uses a **neobrutalism** design language:
- Every element has a hard 2px solid black border
- Every card/panel has a 4px offset drop-shadow (`--shadow`)
- Typography uses font-weight 900 with `uppercase tracking-[0.08em]` everywhere
- Buttons press by physically translating to "absorb" the shadow
- Colors are defined via OKLCH custom properties applied inline with `var(--x)`
- No rounding anywhere — all squares and rectangles
- Result: visually noisy, difficult to scan, overwhelming for new users

---

## Design Direction: Clean Modern

Move to a **modern clean design system** that prioritises:
1. **Visual hierarchy** — clear difference between background, surface, and interactive layers
2. **Readability** — moderate font weights, proper line-heights, controlled tracking
3. **Depth via blur-shadows** — soft gaussian shadows and backdrop-filter, not offset lines
4. **Rounded shapes** — approachable corners, pill badges, subtle radius on cards
5. **Breathing room** — generous but consistent spacing
6. **Smooth interactions** — scale transitions, opacity fades, no hard jumps

The service colour palette (Redis orange, Kafka purple, etc.) is retained — it is semantically useful for the simulation and well-chosen. Only the presentation layer changes.

---

## Phase 1 — Design Token Foundation (`app.css`) ✅ COMPLETED

### Remove
- `--border: oklch(0% 0 0)` (pure black)
- `--box-shadow-x / --box-shadow-y` (offset shadow variables)
- `--shadow: 4px 4px 0 0 var(--border)` (neobrutalism shadow)
- `@utility neo-panel` (hard border + offset shadow)
- `@utility neo-press` (translate to "press")
- `.guide-badge` hard 2px border + box-shadow

### Add — New Token Set

```css
:root {
  /* Shape */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Borders — soft neutral, not black */
  --border: oklch(88% 0.01 90);
  --border-strong: oklch(76% 0.01 90);

  /* Elevation shadows (blur-based, not offset) */
  --shadow-xs: 0 1px 2px rgb(0 0 0 / 0.06);
  --shadow-sm: 0 1px 3px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04);

  /* Surfaces (3 elevation levels) */
  --background: oklch(97% 0.005 90);   /* page background */
  --surface:    oklch(100% 0 0);        /* card / panel */
  --surface-2:  oklch(96% 0.007 90);   /* inset / subtle area */

  /* Text */
  --foreground:   oklch(15% 0.01 260);  /* primary text */
  --muted:        oklch(55% 0.01 90);   /* secondary/meta text */

  /* Service colours — keep existing OKLCH values */
  --main:     oklch(67.47% 0.1725 259.61);
  --redis:    oklch(62% 0.25 29);
  --bullmq:   oklch(75% 0.18 85);
  --rabbitmq: oklch(65% 0.2 145);
  --kafka:    oklch(55% 0.15 300);
  --postgres: oklch(60% 0.15 230);
}

.dark {
  --border:        oklch(30% 0.02 260);
  --border-strong: oklch(40% 0.02 260);
  --background:    oklch(11% 0.015 260);
  --surface:       oklch(17% 0.02 260);
  --surface-2:     oklch(22% 0.025 260);
  --foreground:    oklch(96% 0.005 90);
  --muted:         oklch(62% 0.01 260);

  --main:     oklch(76% 0.15 255);
  --redis:    oklch(69% 0.21 29);
  --bullmq:   oklch(81% 0.14 90);
  --rabbitmq: oklch(74% 0.16 145);
  --kafka:    oklch(75% 0.12 295);
  --postgres: oklch(75% 0.11 235);
}
```

### New Utility Classes

```css
/* Replace neo-panel */
@utility card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

/* Inset/subtle variant */
@utility card-inset {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

/* Interactive card — hover lifts */
@utility card-interactive {
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
    box-shadow: var(--shadow-xs);
  }
}

/* Replace neo-press — scale instead of translate */
@utility press {
  transition: transform 0.1s ease;
  &:active { transform: scale(0.97); }
}
```

### Typography Reset

```css
@layer base {
  body {
    color: var(--foreground);
    font-family: var(--font-base);
    font-size: 15px;
    line-height: 1.6;
    /* keep gradient background, just softer colours */
  }

  /* Remove universal "border-color: var(--border)" — apply per-component */
}
```

Remove pervasive `text-xs font-black uppercase tracking-wide` from section headers.
Replace with `text-sm font-semibold text-[var(--muted)]` label style.

---

## Phase 2 — Layout Shell ✅ COMPLETED

### `top-nav.tsx` Changes

**From:** Solid `bg-[var(--background)]` rectangle with full `neo-panel` border + shadow.

**To:** Frosted glass bar — `backdrop-blur-md bg-[var(--surface)]/80 border-b border-[var(--border)]`

Key changes:
- Remove `mx-3 mt-3` floating gap — make nav flush to top, full-width
- Logo: rounded square instead of borderless square. `rounded-lg bg-[var(--main)] h-8 w-8`
- "SV" badge: remove `border-2 border-[var(--border)] shadow-[var(--shadow)]`, use simple rounded square
- Nav links: replace `neo-panel` pill links with `rounded-md text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]` — ghost style
- Height: `h-14` (56px), single-row on all breakpoints via proper flex
- Sticky glass: `sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md`

```tsx
<header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)]/80 px-4 backdrop-blur-md md:px-6">
  <Link to="/" className="flex items-center gap-2.5 font-semibold">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--main)] text-xs font-bold text-white">SV</span>
    <span className="hidden md:block">System Visualizer</span>
  </Link>
  <div className="flex-1"><ScenarioTabs /></div>
  <nav className="flex items-center gap-1">
    <NavLink to="/">Home</NavLink>
    <NavLink to="/learn">Learn</NavLink>
  </nav>
  <SpeedSlider />
  <ThemeToggle />
</header>
```

### `sidebar.tsx` Changes

**From:** Neo-panel with black border, heavy uppercase headers, hard section dividers.

**To:** Clean panel with soft card sections and proper visual hierarchy.

Key changes:
- Outer: `border-r border-[var(--border)] bg-[var(--surface)] p-4` (no box-shadow on sidebar itself)
- Section headers: `text-xs font-semibold uppercase tracking-wider text-[var(--muted)]` — softer label style
- Links in sidebar: rounded `rounded-md` items, `hover:bg-[var(--surface-2)]` hover state
- Keyboard shortcuts: `card-inset p-3 rounded-lg` with soft label style
- Width: keep 300px but add `min-w-[260px]`

### Root Layout (`__root.tsx`) Changes

Current layout wraps content in `<main>` without a max-width. Add:
- `<div className="mx-auto max-w-screen-2xl">` wrapper inside main
- Consistent page padding: `p-4 md:p-6`
- Sidebar: `w-[280px] flex-shrink-0` — fixed width, not stretched

---

## Phase 3 — Content Pages ✅ COMPLETED

### `routes/index.tsx` (Home Page)

**Hero Section:**
- Remove `neo-panel` outer wrapper for the page
- Hero card: `card rounded-2xl p-6 md:p-10` with gradient blobs kept (they look good)
- Badge above title: `inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--muted)]` — pill badge, not hard-bordered rectangle
- Title: `text-4xl font-bold` (not 900 weight, not 5xl), max `text-5xl` on desktop
- Subtitle: `text-base text-[var(--muted)] leading-relaxed`
- CTA buttons: use new rounded button variants

**Stats grid (Live Preview):**
- Each stat: `card-inset rounded-xl p-3` with colored left border (`border-l-2 border-[var(--redis)]`) instead of full coloured backgrounds
- Stat label: `text-xs text-[var(--muted)]`
- Stat value: `text-2xl font-bold`

**Scenario Cards:**
- `card card-interactive rounded-xl p-4` with hover lift
- Difficulty badge: `rounded-full px-2.5 py-0.5 text-xs font-medium` — pill style, coloured background at 15% opacity
- Problem text: `text-sm text-[var(--muted)] leading-relaxed mt-2`

**Technology Highlights:**
- `card-inset rounded-lg p-3` with coloured service indicator dot

### `routes/learn/` Pages

- Replace all `neo-panel` with `card` or `card-inset`
- Replace uppercase section headers with semibold label style
- Concept cards: `card rounded-xl p-5` with clear title hierarchy

---

## Phase 4 — Scenario Visualization ✅ COMPLETED

### `main-canvas-shell.tsx` Changes

The three-panel layout (FlowCanvas / EventFeed / Metrics) is structurally sound. Change the visual treatment:

- Panel headers: remove hard black `neo-panel` title bars → use `border-b border-[var(--border)] px-4 py-2.5` header strip with `text-sm font-semibold`
- Flow canvas container: `card rounded-xl overflow-hidden`
- Event feed container: `card rounded-xl overflow-hidden flex flex-col`
- Metrics grid: each metric card uses `card-inset rounded-lg p-3`
- Connection status dot: keep `bg-emerald-500` dot, add `rounded-full` (already has it)
- Focus panel tabs: replace hard-bordered tab strip with `rounded-lg bg-[var(--surface-2)] p-1` pill tabs

### `service-node.tsx` Changes

**From:** `neo-panel min-w-[170px] bg-[var(--background)] p-3` with colored border.

**To:** Modern node card with colored accent stripe:

```tsx
<article
  className="min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden"
>
  {/* Colored accent top bar */}
  <div className="h-1" style={{ background: `var(${data.colorVar})` }} />
  <div className="p-3">
    {/* header row */}
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Server className="h-3.5 w-3.5 text-[var(--muted)]" />
        {data.label}
      </p>
      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
    </div>
    {/* stats row */}
    <div className="mt-2 flex gap-1.5">
      <StatPill label="Ops/s" value={data.opsPerSec.toFixed(1)} />
      <StatPill label="Queue" value={data.queueDepth} />
    </div>
  </div>
</article>
```

The colored **top bar** (1px accent strip) gives each node its identity without a full border-color override. Cleaner and easier to read.

### `phase-stepper.tsx` Changes

**From:** Hard-bordered buttons with translate-on-press.

**To:** Timeline-style stepper:

```tsx
<ol className="relative space-y-1 pl-6 before:absolute before:left-2.5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[var(--border)]">
  {phases.map((phase) => (
    <li key={phase.id} className="relative">
      {/* Step indicator dot on the timeline */}
      <span className={cn(
        "absolute -left-[15px] flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold border-2",
        isActive
          ? "border-[var(--main)] bg-[var(--main)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
      )}>
        {phase.id}
      </span>
      <button
        type="button"
        className={cn(
          "w-full rounded-lg px-3 py-2 text-left transition-colors",
          isActive ? "bg-[var(--main)]/10" : "hover:bg-[var(--surface-2)]"
        )}
      >
        <p className={cn("text-sm font-semibold", isActive && "text-[var(--main)]")}>
          {phase.title}
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">{phase.description}</p>
        {/* Service tags */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {phase.services.map((s) => (
            <span
              key={s}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: `color-mix(in oklch, var(${serviceColorVarByName[s]}) 15%, transparent)`, color: `var(${serviceColorVarByName[s]})` }}
            >
              {s}
            </span>
          ))}
        </div>
      </button>
    </li>
  ))}
</ol>
```

### `button.tsx` Changes

**From:** Hard border + offset shadow + translate-press neobrutalism button.

**To:** Modern rounded button:

```ts
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--main)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--main)] text-white shadow-sm hover:brightness-110 active:scale-[0.97]",
        secondary:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-xs hover:bg-[var(--surface-2)] active:scale-[0.97]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--surface-2)] active:scale-[0.97]",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 active:scale-[0.97]",
      },
      size: {
        default: "h-9 px-4",
        sm:      "h-7 px-3 text-xs rounded-md",
        lg:      "h-11 px-6",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

Note: Add `secondary` variant (the old `ghost` mostly served as an outlined/secondary style). The new `ghost` is truly transparent with only hover background.

### `scenario-tabs.tsx` Changes

**From:** Array of `Button` with `variant="ghost"` or `variant="default"`.

**To:** Pill tab group inside a pill container:

```tsx
<nav className="flex items-center gap-1 rounded-lg bg-[var(--surface-2)] p-1" aria-label="Scenario tabs">
  {scenarioTabs.map((tab) => (
    <Link
      key={tab.label}
      to={tab.to}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-[var(--surface)] shadow-xs text-[var(--foreground)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      )}
    >
      {tab.label}
    </Link>
  ))}
</nav>
```

### `event-feed.tsx` / `event-entry.tsx` Changes

- Entry rows: remove `neo-panel` → `rounded-md hover:bg-[var(--surface-2)]` row hover
- Timestamp: `text-xs text-[var(--muted)] tabular-nums`
- Service badge pill: `rounded-full px-2 py-0.5 text-[10px] font-medium` with translucent service colour

### `what-if-toggle.tsx` Changes

- Toggle button: rounded toggle with `rounded-lg border border-[var(--border)]`
- Active/danger state: `border-red-400 bg-red-50 dark:bg-red-950/30` instead of `what-if-failure` shake
- The shake animation can stay but soften: use `animate-[wiggle_0.5s_ease-in-out_3]` (runs 3 times, not infinite)

### `why-tooltip.tsx` Changes

- Tooltip container: `card rounded-xl shadow-lg p-3`
- Remove hard border treatment

### `service-card.tsx` (monitor) Changes

- Card: `card rounded-xl p-4`
- Activity chart: keep recharts, no style change needed
- Status indicator: pill badge `rounded-full`

### `activity-bar.tsx` Changes

- Bars: `rounded-sm` instead of sharp rectangles

### Animations — Keep but Soften

Keep these animations (functionally useful):
- `scenario-enter` — entrance animation for scenario load ✓
- `skeleton-wave` — loading shimmer ✓
- `guide-pulse` — onboarding highlight ✓

Update `guide-pulse` to use the new `--shadow-md` reference instead of `var(--shadow)`.

Update `what-if-failure` shake to run 3× then stop (not infinite) — infinite shake is distracting.

Update `guide-badge` to use `rounded-sm` instead of hard square.

---

## Phase 5 — `learn/$concept.tsx` and `learn/index.tsx` ✅ COMPLETED

- Page container: `max-w-3xl mx-auto py-8 px-4`
- Concept sections: `card rounded-2xl p-6 mb-4`
- Code blocks: `card-inset rounded-lg font-mono text-sm p-4`
- Tags: pill badges `rounded-full`

---

## File Change Inventory

| File | Change Type | Notes |
|------|-------------|-------|
| `src/styles/app.css` | **Full rewrite** | New tokens, utilities, animations |
| `src/components/ui/button.tsx` | **Rewrite variants** | Rounded, 4 variants |
| `src/components/layout/top-nav.tsx` | **Redesign** | Frosted glass, compact |
| `src/components/layout/sidebar.tsx` | **Redesign** | Soft cards, label hierarchy |
| `src/routes/__root.tsx` | Minor | Max-width wrapper, padding |
| `src/routes/index.tsx` | **Redesign** | Modern hero, pill badges, lift cards |
| `src/routes/learn/index.tsx` | Moderate | Replace neo-panel |
| `src/routes/learn/$concept.tsx` | Moderate | Replace neo-panel |
| `src/routes/scenarios/*.tsx` | Minor | Shell pass-through |
| `src/components/layout/main-canvas-shell.tsx` | **Redesign** | Panel headers, focus tabs |
| `src/components/flow/service-node.tsx` | **Redesign** | Accent stripe, cleaner stats |
| `src/components/flow/message-badge.tsx` | Minor | Rounded pill |
| `src/components/flow/animated-edge.tsx` | Minor | Colour only |
| `src/components/monitor/service-card.tsx` | Moderate | Card style |
| `src/components/monitor/activity-bar.tsx` | Minor | Rounded bars |
| `src/components/event-log/event-feed.tsx` | Moderate | Row hover, no neo-panel |
| `src/components/event-log/event-entry.tsx` | Moderate | Pill badge, muted meta |
| `src/components/event-log/log-filters.tsx` | Moderate | Pill filter chips |
| `src/components/learning/phase-stepper.tsx` | **Redesign** | Timeline stepper |
| `src/components/learning/concept-card.tsx` | Moderate | card classes |
| `src/components/learning/summary-card.tsx` | Moderate | card classes |
| `src/components/learning/what-if-toggle.tsx` | Moderate | Rounded toggle |
| `src/components/learning/why-tooltip.tsx` | Minor | card tooltip |
| `src/components/controls/scenario-tabs.tsx` | **Redesign** | Pill tab group |
| `src/components/controls/speed-slider.tsx` | Minor | Remove neo-panel frame |

Total: ~25 files. All are style-only changes — no logic, hooks, or data flow changes.

---

## Implementation Status: ALL PHASES COMPLETE ✅

Typecheck: 0 errors. No `neo-panel`, `font-black`, `--shadow` (old), or neobrutalism tokens remain in any source file.

## Implementation Order

1. **`app.css`** first — establishes the token foundation. Stops existing neo-panel working, so temporarily things look broken.
2. **`button.tsx`** — needed by almost everything.
3. **`top-nav.tsx` + `sidebar.tsx`** — visible on every page.
4. **`routes/index.tsx`** — easiest full page to validate the new look.
5. **`service-node.tsx` + `scenario-tabs.tsx`** — core of the scenario view.
6. **`main-canvas-shell.tsx`** — complex but mainly CSS class swaps.
7. **`phase-stepper.tsx`** — most structural change in learning panel.
8. Remaining monitor / event / learning components.
9. **Learn pages** — last, since they have less interactivity to validate.

---

## Non-Goals / Out of Scope

- No changes to routing, data flow, hooks, WebSocket logic, or simulation state
- No new dependencies — all changes use existing Tailwind 4 + CSS custom properties
- No changes to recharts or xyflow internals — only wrapper styling
- No changes to server code
- No new animation libraries

---

## UX Improvements That Come for Free

Replacing the design tokens automatically delivers:

| Before | After |
|--------|-------|
| Harsh black borders on every element | Soft neutral borders, breathing room |
| Heavy ALL-CAPS text everywhere | Clear type hierarchy, readable labels |
| Offset shadows create visual noise | Blur shadows add clean depth |
| Button press = physically moves element | Button press = subtle scale |
| Phase steps look like blocky UI buttons | Phase steps read as a timeline |
| Service tags look like warning labels | Service tags read as soft pills |
| Nav looks heavy and landed | Nav is light, stays out of the way |
| Cards all look equal weight | Elevation levels guide eye to what matters |
