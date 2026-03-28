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
        <div className="min-h-dvh pb-6">
          <TopNav />
          <main className="mx-3 mt-3 grid gap-3 md:mx-6 md:grid-cols-[280px,1fr]">
            <Sidebar />
            <section>{children}</section>
          </main>
        </div>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
