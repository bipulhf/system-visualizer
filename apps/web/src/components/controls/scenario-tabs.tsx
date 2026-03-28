import { useState } from "react";
import { Button } from "~/components/ui/button";

const scenarioNames = [
  "Flash Sale",
  "Ride Sharing",
  "Video Pipeline",
  "Banking",
] as const;

export function ScenarioTabs() {
  const [activeScenario, setActiveScenario] = useState<string>(
    scenarioNames[0],
  );

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Scenario tabs">
      {scenarioNames.map((scenario) => (
        <Button
          key={scenario}
          variant={activeScenario === scenario ? "default" : "ghost"}
          size="sm"
          type="button"
          onClick={() => {
            setActiveScenario(scenario);
          }}
        >
          {scenario}
        </Button>
      ))}
    </nav>
  );
}
