/* @jsxRuntime classic */
import * as React from "react";
import { useRouterState } from "@tanstack/react-router";
import { PhaseStepper } from "~/components/learning/phase-stepper";
import { WhatIfToggle } from "~/components/learning/what-if-toggle";
import { WhyTooltip } from "~/components/learning/why-tooltip";
import { scenarioInfoById } from "~/lib/learning-content";
import { resolveScenarioFromPathname } from "~/lib/scenario";

export function Sidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
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
