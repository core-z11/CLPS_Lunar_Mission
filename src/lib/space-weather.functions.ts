/**
 * Space weather adapter.
 *
 * Live source: NOAA SWPC public JSON products (planetary K-index, real-time
 * solar wind plasma/magnetic field, GOES X-ray flux). If any product is
 * unavailable the adapter degrades gracefully and the UI shows DEMO SIMULATION
 * for the missing values instead of mixing provenance silently.
 */

import { createServerFn } from "@tanstack/react-start";

export type WeatherLevel = "QUIET" | "ELEVATED" | "ACTIVE" | "SEVERE" | "UNKNOWN";
export type Provenance = "LIVE" | "DEMO";

export interface SpaceWeatherEvent {
  id: string;
  type: "FLARE" | "CME" | "SEP" | "STORM";
  label: string;
  time: string;
  intensity: string;
  source: string;
}

export interface SpaceWeatherPayload {
  status: WeatherLevel;
  provenance: Provenance;
  updatedAt: string;
  planetaryK: { value: number | null; provenance: Provenance; source: string };
  solarWind: {
    speedKmS: number | null;
    densityPerCm3: number | null;
    bzNt: number | null;
    provenance: Provenance;
    source: string;
  };
  xray: { class: string | null; provenance: Provenance; source: string };
  events: SpaceWeatherEvent[];
  notes: string[];
}

const SWPC = "https://services.swpc.noaa.gov";

const demoPayload = (notes: string[]): SpaceWeatherPayload => ({
  status: "ELEVATED",
  provenance: "DEMO",
  updatedAt: new Date().toISOString(),
  planetaryK: { value: 4, provenance: "DEMO", source: "Deterministic demo scenario" },
  solarWind: {
    speedKmS: 486,
    densityPerCm3: 5.4,
    bzNt: -3.2,
    provenance: "DEMO",
    source: "Deterministic demo scenario",
  },
  xray: { class: "C3.1", provenance: "DEMO", source: "Deterministic demo scenario" },
  events: [
    {
      id: "demo-flare",
      type: "FLARE",
      label: "M1.4 solar flare",
      time: new Date(Date.now() - 9 * 3600e3).toISOString(),
      intensity: "M1.4",
      source: "Demo scenario",
    },
    {
      id: "demo-cme",
      type: "CME",
      label: "CME — not identified as Earth-directed in demo feed",
      time: new Date(Date.now() - 20 * 3600e3).toISOString(),
      intensity: "Speed ~640 km/s",
      source: "Demo scenario",
    },
    {
      id: "demo-sep",
      type: "SEP",
      label: "Proton flux enhancement below alert threshold",
      time: new Date(Date.now() - 31 * 3600e3).toISOString(),
      intensity: "Sub-threshold",
      source: "Demo scenario",
    },
  ],
  notes,
});

const levelFromInputs = (kp: number | null, xrayClass: string | null): WeatherLevel => {
  let level: WeatherLevel = "QUIET";
  if (kp !== null) {
    if (kp >= 7) level = "SEVERE";
    else if (kp >= 5) level = "ACTIVE";
    else if (kp >= 4) level = "ELEVATED";
  }
  if (xrayClass) {
    const letter = xrayClass[0]?.toUpperCase();
    if (letter === "X" && level !== "SEVERE") level = "SEVERE";
    else if (letter === "M" && level === "QUIET") level = "ELEVATED";
  }
  return level;
};

const xrayClassFromFlux = (flux: number): string => {
  if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
  if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
  if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
  if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
  return `A${(flux / 1e-8).toFixed(1)}`;
};

async function getJson(url: string, timeoutMs = 6000): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const getSpaceWeather = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpaceWeatherPayload> => {
    const notes: string[] = [];
    const [kpRaw, windRaw, magRaw, xrayRaw] = await Promise.all([
      getJson(`${SWPC}/products/noaa-planetary-k-index.json`),
      getJson(`${SWPC}/products/solar-wind/plasma-2-hour.json`),
      getJson(`${SWPC}/products/solar-wind/mag-2-hour.json`),
      getJson(`${SWPC}/json/goes/primary/xrays-1-day.json`),
    ]);

    let kp: number | null = null;
    if (Array.isArray(kpRaw) && kpRaw.length > 1) {
      const last = kpRaw[kpRaw.length - 1] as unknown[];
      const v = Number(last?.[1]);
      if (Number.isFinite(v)) kp = v;
    }
    if (kp === null) notes.push("Planetary K-index feed unavailable — showing demo value.");

    let speed: number | null = null;
    let density: number | null = null;
    if (Array.isArray(windRaw) && windRaw.length > 1) {
      const last = windRaw[windRaw.length - 1] as unknown[];
      const d = Number(last?.[1]);
      const s = Number(last?.[2]);
      if (Number.isFinite(d)) density = d;
      if (Number.isFinite(s)) speed = s;
    }
    let bz: number | null = null;
    if (Array.isArray(magRaw) && magRaw.length > 1) {
      const last = magRaw[magRaw.length - 1] as unknown[];
      const v = Number(last?.[3]);
      if (Number.isFinite(v)) bz = v;
    }
    if (speed === null) notes.push("Real-time solar wind feed unavailable — showing demo values.");

    let xrayClass: string | null = null;
    const events: SpaceWeatherEvent[] = [];
    if (Array.isArray(xrayRaw)) {
      const longBand = (xrayRaw as Record<string, unknown>[]).filter(
        (d) => d["energy"] === "0.1-0.8nm",
      );
      if (longBand.length) {
        const peak = longBand.reduce((a, b) =>
          Number(a["flux"]) > Number(b["flux"]) ? a : b,
        );
        const latest = longBand[longBand.length - 1];
        xrayClass = xrayClassFromFlux(Number(latest!["flux"]));
        events.push({
          id: "goes-peak",
          type: "FLARE",
          label: `Peak GOES X-ray flux (24 h): ${xrayClassFromFlux(Number(peak["flux"]))}`,
          time: String(peak["time_tag"]),
          intensity: xrayClassFromFlux(Number(peak["flux"])),
          source: "NOAA SWPC / GOES XRS",
        });
      }
    }
    if (!xrayClass) notes.push("GOES X-ray feed unavailable — showing demo value.");

    const anyLive = kp !== null || speed !== null || xrayClass !== null;
    if (!anyLive) {
      return demoPayload([
        "All live space-weather feeds were unreachable. Displaying the deterministic demo scenario.",
      ]);
    }

    const demo = demoPayload([]);
    return {
      status: levelFromInputs(kp, xrayClass),
      provenance: kp !== null && speed !== null && xrayClass !== null ? "LIVE" : "DEMO",
      updatedAt: new Date().toISOString(),
      planetaryK:
        kp !== null
          ? { value: kp, provenance: "LIVE", source: "NOAA SWPC planetary K-index" }
          : demo.planetaryK,
      solarWind:
        speed !== null
          ? {
              speedKmS: speed,
              densityPerCm3: density,
              bzNt: bz,
              provenance: "LIVE",
              source: "NOAA SWPC real-time solar wind (DSCOVR/ACE)",
            }
          : demo.solarWind,
      xray: xrayClass
        ? { class: xrayClass, provenance: "LIVE", source: "NOAA SWPC / GOES XRS" }
        : demo.xray,
      events: events.length ? [...events, ...demo.events.slice(1)] : demo.events,
      notes,
    };
  },
);
