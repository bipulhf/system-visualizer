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
    return null;
  }

  const scenarioId = resolveScenarioFromPathname(pathname);
  const info = scenarioInfoById[scenarioId];

  return (
    <aside className="flex h-full flex-col gap-4 border-r border-[var(--border)] bg-[var(--surface)] p-4">
      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold">{info.title}</h2>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {info.tagline}
        </p>
      </section>

      <div className="card-inset rounded-lg p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          The Problem
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed">{info.problem}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
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
