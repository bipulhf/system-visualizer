import { createFileRoute } from "@tanstack/react-router";
import { MainCanvasShell } from "~/components/layout/main-canvas-shell";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <MainCanvasShell />;
}
