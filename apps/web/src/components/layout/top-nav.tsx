/* @jsxRuntime classic */
import * as React from "react";
import { ScenarioTabs } from "~/components/controls/scenario-tabs";
import { SpeedSlider } from "~/components/controls/speed-slider";
import { ThemeToggle } from "~/components/layout/theme-toggle";

export function TopNav() {
  return (
    <header className="neo-panel sticky top-0 z-30 mx-3 mt-3 grid gap-3 bg-[var(--background)] p-3 md:mx-6 md:grid-cols-[auto,1fr,auto,auto] md:items-center">
      <div className="flex items-center gap-2 text-base font-black tracking-tight md:text-lg">
        <span className="inline-flex h-9 w-9 items-center justify-center border-2 border-[var(--border)] bg-[var(--main)] shadow-[var(--shadow)]">
          <span className="text-sm font-black">SV</span>
        </span>
        System Visualizer
      </div>

      <ScenarioTabs />

      <SpeedSlider />

      <ThemeToggle />
    </header>
  );
}
