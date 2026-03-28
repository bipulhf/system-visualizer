import { createFileRoute } from "@tanstack/react-router";
import { MainCanvasShell } from "~/components/layout/main-canvas-shell";

export const Route = createFileRoute("/scenarios/ride-sharing")({
  component: RideSharingPage,
});

function RideSharingPage() {
  return <MainCanvasShell scenarioId="ride-sharing" />;
}
