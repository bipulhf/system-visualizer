/* @jsxRuntime classic */
import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { PhaseStepper } from "~/components/learning/phase-stepper";
import { WhatIfToggle } from "~/components/learning/what-if-toggle";
import { WhyTooltip } from "~/components/learning/why-tooltip";
import { scenarioInfoById } from "~/lib/learning-content";
import { resolveScenarioFromPathname } from "~/lib/scenario";

export function Sidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!pathname.startsWith("/scenarios/")) {
    return (
      <aside className="neo-panel flex h-full flex-col gap-4 bg-[var(--background)] p-4">
        <section className="space-y-2">
          <h2 className="text-lg font-black tracking-tight">
            Learning Navigation
          </h2>
          <p className="text-sm leading-relaxed">
            Start a simulation track or browse the glossary before jumping to a
            live phase.
          </p>
        </section>

        <div className="space-y-2">
          <Link
            to="/"
            className="neo-panel block bg-[var(--surface)] px-3 py-2 text-xs font-black uppercase tracking-wide"
          >
            Landing Page
          </Link>
          <Link
            to="/learn"
            className="neo-panel block bg-[var(--surface)] px-3 py-2 text-xs font-black uppercase tracking-wide"
          >
            Learn Section
          </Link>
          <Link
            to="/scenarios/flash-sale"
            className="neo-panel block bg-[var(--main)] px-3 py-2 text-xs font-black uppercase tracking-wide"
          >
            Enter Simulation
          </Link>
        </div>

        <section className="neo-panel bg-[var(--surface)] p-3">
          <h3 className="text-xs font-black uppercase tracking-wide">
            Keyboard Shortcuts
          </h3>
          <ul className="mt-2 space-y-1 text-xs font-semibold">
            <li>Space: Pause or resume simulation playback</li>
            <li>Arrow Left/Right: Step one event when paused</li>
            <li>Keys 1-4: Set speed preset</li>
          </ul>
        </section>
      </aside>
    );
  }

  const scenarioId = resolveScenarioFromPathname(pathname);
  const info = scenarioInfoById[scenarioId];

  return (
    <aside className="neo-panel flex h-full flex-col gap-4 bg-[var(--background)] p-4">
      <section className="space-y-2">
        <h2 className="text-lg font-black tracking-tight">{info.title}</h2>
        <p className="text-sm leading-relaxed">{info.tagline}</p>
      </section>

      <section className="neo-panel bg-white/70 p-3 dark:bg-black/30">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          The Problem
        </h3>
        <p className="mt-2 text-sm">{info.problem}</p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Learning Panel
        </h3>
        <div className="space-y-4">
          <PhaseStepper scenarioId={scenarioId} />
          <WhyTooltip scenarioId={scenarioId} />
          <WhatIfToggle scenarioId={scenarioId} />
        </div>
      </section>
    </aside>
  );
}
