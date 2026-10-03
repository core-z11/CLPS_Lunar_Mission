import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Disclaimer } from "@/components/kit";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="label-xs">Signal lost</p>
        <h1 className="metric mt-3 text-6xl text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is outside the mission area.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This view didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LunaSight — Mission Planning for the Lunar South Pole" },
      {
        name: "description",
        content: "Compare lunar south-pole landing sites and dates: Sun, Earth, relay and space-weather conditions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Mission" },
  { to: "/explore", label: "Explore" },
  { to: "/compare", label: "Compare" },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-4 md:px-6">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="relative inline-block h-5 w-5 rounded-full bg-regolith">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-shadow-zone" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">LunaSight</span>
              <span className="hidden label-xs lg:inline">Find the Window. Plan the Mission.</span>
            </Link>
            <nav className="-mx-2 flex flex-1 items-center gap-1 overflow-x-auto md:justify-end">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  activeOptions={{ exact: true }}
                  activeProps={{ className: "text-foreground bg-accent/70" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-8 md:grid-cols-2 md:px-6">
            <Disclaimer />
            <p className="text-xs leading-relaxed text-muted-foreground md:text-right">
              Ephemerides: analytic Sun/Moon series with IAU/WGCCRE lunar rotation model. Space
              weather: NOAA SWPC public products. Relay constellation: simulation only. Terrain
              descriptors: planning estimates informed by published NASA LRO/LOLA literature.
              NASA Space Apps Challenge 2026 prototype — not affiliated with or endorsed by NASA.
            </p>
          </div>
        </footer>
      </div>
    </QueryClientProvider>
  );
}
