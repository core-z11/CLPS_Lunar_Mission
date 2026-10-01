import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero-south-pole.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LunaSight — Plan the Mission. See the Window." },
      {
        name: "description",
        content:
          "Explore Sun, Earth, relay and space-weather conditions at lunar south-pole landing sites before committing to a scenario.",
      },
      { property: "og:title", content: "LunaSight — Plan the Mission. See the Window." },
      {
        property: "og:description",
        content: "Lunar south-pole mission planning: illumination, direct-to-Earth windows, relays and space weather.",
      },
    ],
  }),
  component: Home,
});

const CAPS = [
  {
    k: "Illumination",
    tone: "text-sun",
    d: "Sun elevation and azimuth above the local horizon, sunlit duty cycle and power-window timelines.",
  },
  {
    k: "Communication",
    tone: "text-earth",
    d: "Earth line-of-sight, direct-to-Earth windows, and end-to-end routing through a simulated relay network.",
  },
  {
    k: "Terrain",
    tone: "text-foreground",
    d: "Slope, relief and roughness descriptors for a configurable landing zone, with explicit data confidence.",
  },
  {
    k: "Space Weather",
    tone: "text-caution",
    d: "Near-real-time K-index, solar wind and X-ray flux translated into plain planning considerations.",
  },
];

function Home() {
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <img
          src={hero}
          alt="Low sunlight across lunar south-pole craters with Earth on the horizon"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/40 via-background/30 to-background" />
        <div className="mx-auto flex min-h-[78vh] max-w-[1500px] flex-col justify-end px-4 pb-20 pt-32 md:px-6">
          <p className="label-xs">NASA Space Apps Challenge 2026 · Prototype</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-light leading-[1.05] tracking-tight md:text-7xl">
            Plan the Mission.
            <br />
            <span className="font-medium">See the Window.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Explore illumination, terrain, space weather, and lunar communication opportunities before
            committing to a south-pole landing scenario.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/planner"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Open Mission Planner
            </Link>
            <Link
              to="/compare"
              className="rounded-md border border-border bg-panel px-5 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              Compare South Pole Sites
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 py-16 md:px-6">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
          {CAPS.map((c) => (
            <div key={c.k} className="bg-background p-6">
              <p className={`label-xs ${c.tone}`}>{c.k}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="label-xs">How it works</p>
            <h2 className="mt-3 text-3xl font-light tracking-tight">Location + time → one mission view.</h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-2">
            {[
              ["01", "Pick a site", "Choose a documented south-pole candidate, enter coordinates, or click the map."],
              ["02", "Set the time", "Scrub through hours, days or a full lunar month and watch the sky move."],
              ["03", "Read the sky", "See Sun, Earth and relays against the local horizon in one dial."],
              ["04", "Compare", "Line up sites and dates side by side with an explainable indicator."],
            ].map(([n, t, d]) => (
              <li key={n} className="border-t border-border pt-4">
                <span className="metric text-sm text-primary">{n}</span>
                <p className="mt-1 font-medium">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 panel p-6">
          <p className="label-xs">Built on open science data</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            LunaSight uses the IAU/WGCCRE lunar rotation model, analytic solar and lunar ephemerides
            validated against JPL Horizons-class references, NOAA SWPC public space-weather products, and
            site descriptors informed by NASA LRO / LOLA literature. Every value is labelled LIVE, MODELLED
            or SIMULATED. LunaSight is not affiliated with or endorsed by NASA.
          </p>
          <Link to="/data" className="mt-4 inline-block text-sm text-primary hover:underline">
            Review data sources →
          </Link>
        </div>
      </section>
    </div>
  );
}
