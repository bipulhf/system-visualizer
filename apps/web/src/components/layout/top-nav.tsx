import { Rocket } from "lucide-react";
import { ThemeToggle } from "~/components/layout/theme-toggle";
import { Button } from "~/components/ui/button";

const scenarios = ["Flash Sale", "Ride Sharing", "Video Pipeline", "Banking"];
const speeds = ["0.25x", "0.5x", "1x", "2x", "4x"];

export function TopNav() {
  return (
    <header className="neo-panel sticky top-0 z-30 mx-3 mt-3 grid gap-3 bg-[var(--background)] p-3 md:mx-6 md:grid-cols-[auto,1fr,auto,auto] md:items-center">
      <div className="flex items-center gap-2 text-base font-black tracking-tight md:text-lg">
        <span className="inline-flex h-9 w-9 items-center justify-center border-2 border-[var(--border)] bg-[var(--main)] shadow-[var(--shadow)]">
          <Rocket className="h-4 w-4" />
        </span>
        System Visualizer
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Scenario tabs">
        {scenarios.map((scenario, index) => (
          <Button
            key={scenario}
            variant={index === 0 ? "default" : "ghost"}
            size="sm"
            type="button"
          >
            {scenario}
          </Button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest">
          Speed
        </span>
        <div className="inline-flex border-2 border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow)]">
          {speeds.map((speed, index) => (
            <button
              key={speed}
              type="button"
              className={`px-2 py-1 text-xs font-bold ${index === 2 ? "bg-[var(--foreground)] text-[var(--background)]" : ""}`}
            >
              {speed}
            </button>
          ))}
        </div>
      </div>

      <ThemeToggle />
    </header>
  );
}
