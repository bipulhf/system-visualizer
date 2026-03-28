import { createFileRoute } from "@tanstack/react-router";
import { MainCanvasShell } from "~/components/layout/main-canvas-shell";

export const Route = createFileRoute("/scenarios/banking")({
  component: BankingScenarioPage,
});

function BankingScenarioPage() {
  return <MainCanvasShell scenarioId="banking" />;
}
