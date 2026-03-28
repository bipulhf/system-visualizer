/* @jsxRuntime classic */
import * as React from "react";
import { PhaseStepper } from "~/components/learning/phase-stepper";
import { WhatIfToggle } from "~/components/learning/what-if-toggle";
import { WhyTooltip } from "~/components/learning/why-tooltip";

export function Sidebar() {
  return (
    <aside className="neo-panel flex h-full flex-col gap-4 bg-[var(--background)] p-4">
      <section className="space-y-2">
        <h2 className="text-lg font-black tracking-tight">Scenario Info</h2>
        <p className="text-sm leading-relaxed">
          Understand how distributed services cooperate in a high-pressure flash
          sale.
        </p>
      </section>

      <section className="neo-panel bg-white/70 p-3 dark:bg-black/30">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          The Problem
        </h3>
        <p className="mt-2 text-sm">
          Ten thousand customers attempt to buy one hundred items in seconds.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Learning Panel
        </h3>
        <div className="space-y-4">
          <PhaseStepper />
          <WhyTooltip />
          <WhatIfToggle />
        </div>
      </section>
    </aside>
  );
}
