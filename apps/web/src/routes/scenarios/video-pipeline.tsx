import { createFileRoute } from "@tanstack/react-router";
import { MainCanvasShell } from "~/components/layout/main-canvas-shell";

export const Route = createFileRoute("/scenarios/video-pipeline")({
  component: VideoPipelinePage,
});

function VideoPipelinePage() {
  return <MainCanvasShell scenarioId="video-pipeline" />;
}
