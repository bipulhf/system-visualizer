import { createFileRoute } from "@tanstack/react-router";
import { MainCanvasShell } from "~/components/layout/main-canvas-shell";

export const Route = createFileRoute("/scenarios/flash-sale")({
  component: FlashSalePage,
});

function FlashSalePage() {
  return <MainCanvasShell scenarioId="flash-sale" />;
}
