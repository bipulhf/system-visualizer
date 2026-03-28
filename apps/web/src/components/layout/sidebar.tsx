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
      <aside className="flex h-full flex-col gap-4 border-r border-[var(--border)] bg-[var(--surface)] p-4">
        <section className="space-y-1.5">
          <h2 className="text-sm font-semibold">Learning Navigation</h2>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Start a simulation track or browse the glossary before jumping to a
            live phase.
          </p>
        </section>

        <div className="space-y-1">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            Landing Page
          </Link>
          <Link
            to="/learn"
            className="block rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            Learn Section
          </Link>
          <Link
            to="/scenarios/flash-sale"
            className="block rounded-md bg-[var(--main)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110"
          >
            Enter Simulation
          </Link>
        </div>

        <div className="card-inset rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Keyboard Shortcuts
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
            <li>
              <span className="font-medium text-[var(--foreground)]">
                Space
              </span>{" "}
              — pause or resume
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">← →</span>{" "}
              — step when paused
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">1–4</span>{" "}
              — set speed preset
            </li>
          </ul>
        </div>
      </aside>
    );
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
