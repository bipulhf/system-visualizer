import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

const scenarioTabs = [
  { label: "Flash Sale", to: "/scenarios/flash-sale", enabled: true },
  { label: "Ride Sharing", to: "/", enabled: false },
  { label: "Video Pipeline", to: "/", enabled: false },
  { label: "Banking", to: "/", enabled: false },
] as const;

export function ScenarioTabs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Scenario tabs">
      {scenarioTabs.map((tab) => {
        const isActive =
          tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);

        if (!tab.enabled) {
          return (
            <Button
              key={tab.label}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              type="button"
              disabled
            >
              {tab.label}
            </Button>
          );
        }

        return (
          <Button
            key={tab.label}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            type="button"
            asChild
          >
            <Link to={tab.to}>{tab.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}
