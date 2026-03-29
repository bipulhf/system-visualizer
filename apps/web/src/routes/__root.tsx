/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { Sidebar } from "~/components/layout/sidebar";
import { TopNav } from "~/components/layout/top-nav";
import { SimulationUiProvider } from "~/lib/simulation-ui-context";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "System Visualizer" },
      {
        name: "description",
        content:
          "Interactive distributed systems visualizer with real infrastructure simulations.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SimulationUiProvider>
          <div className="min-h-dvh">
            <TopNav />
            <main className="grid gap-4 p-4 md:gap-6 md:p-6 md:grid-cols-[280px,1fr]">
              <Sidebar />
              <section className="min-w-0 overflow-x-hidden">{children}</section>
            </main>
          </div>
        </SimulationUiProvider>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
