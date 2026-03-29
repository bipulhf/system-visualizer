/* @jsxRuntime classic */
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ScenarioTabs } from "~/components/controls/scenario-tabs";
import { SpeedSlider } from "~/components/controls/speed-slider";
import { ThemeToggle } from "~/components/layout/theme-toggle";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 shadow-xs md:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--main)] text-xs font-bold text-white">
          SV
        </span>
        <span className="hidden text-sm font-semibold md:block">
          System Visualizer
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <ScenarioTabs />
      </div>

      <nav
        className="flex shrink-0 items-center gap-1"
        aria-label="Primary navigation"
      >
        <Link
          to="/"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Home
        </Link>
        <Link
          to="/learn"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Learn
        </Link>
        <Link
          to="/trace"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Trace
        </Link>
      </nav>

      <SpeedSlider />
      <ThemeToggle />
    </header>
  );
}
