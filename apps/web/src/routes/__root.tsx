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
      { name: "theme-color", content: "#111827" },
      {
        name: "description",
        content:
          "Interactive distributed systems visualizer with real infrastructure simulations.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
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
              <section className="min-w-0 overflow-x-hidden">
                {children}
              </section>
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
