import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultErrorComponent: ({ error }) => (
      <p className="p-4 text-sm font-semibold">{error.message}</p>
    ),
    defaultNotFoundComponent: () => (
      <p className="p-4 text-sm font-semibold">Not found.</p>
    ),
    scrollRestoration: true,
  });
  return router;
}
