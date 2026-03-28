import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "~/lib/utils";

const scenarioTabs = [
  { label: "Flash Sale", to: "/scenarios/flash-sale", enabled: true },
  { label: "Ride Sharing", to: "/scenarios/ride-sharing", enabled: true },
  { label: "Video Pipeline", to: "/scenarios/video-pipeline", enabled: true },
  { label: "Banking", to: "/scenarios/banking", enabled: true },
] as const;

export function ScenarioTabs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav
      className="flex items-center gap-0.5 overflow-x-auto rounded-lg bg-[var(--surface-2)] p-1"
      aria-label="Scenario tabs"
    >
      {scenarioTabs.map((tab) => {
        const isActive = pathname.startsWith(tab.to);

        if (!tab.enabled) {
          return (
            <span
              key={tab.label}
              className="cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-medium text-[var(--muted)] opacity-40"
            >
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.label}
            to={tab.to}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
