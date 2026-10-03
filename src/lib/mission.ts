/**
 * Mission analysis pipeline: illumination windows, direct-to-Earth windows,
 * relay availability and an explainable planning indicator.
 *
 * All outputs are planning-level estimates derived from analytic geometry and
 * modelled terrain. They are not certified engineering products.
 */

import { skyState, type SkyState } from "./astro";
import { relayStates, type RelayState } from "./relays";
import type { Confidence, LunarSite } from "./sites";

export type SpaceWeatherLevel = "QUIET" | "ELEVATED" | "ACTIVE" | "SEVERE" | "UNKNOWN";

export interface SamplePoint {
  time: Date;
  sunElevation: number;
  earthElevation: number;
  relayLinks: number;
  relayIds: string[];
}

export interface Window {
  start: Date;
  end: Date;
  hours: number;
}

export interface SiteAnalysis {
  site: Pick<LunarSite, "lat" | "lon" | "elevationM" | "meanSlope" | "maxSlope" | "reliefM" | "roughness" | "terrainConfidence"> & { name: string };
  now: SkyState;
  relays: RelayState[];
  bestRelay: RelayState | null;
  endToEnd: "AVAILABLE" | "DIRECT" | "GAP";
  samples: SamplePoint[];
  sunlitFraction: number;
  earthVisibleFraction: number;
  relayFraction: number;
  currentDteWindow: { state: "AVAILABLE" | "BLOCKED"; hours: number };
  scores: {
    terrain: number;
    illumination: number;
    communication: number;
    spaceWeather: number;
    confidence: Confidence;
    overall: number;
  };
}

export interface Weights {
  terrain: number;
  illumination: number;
  communication: number;
  spaceWeather: number;
  confidence: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  terrain: 30,
  illumination: 25,
  communication: 25,
  spaceWeather: 10,
  confidence: 10,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const confidenceValue = (c: Confidence) => (c === "HIGH" ? 95 : c === "MEDIUM" ? 70 : 40);

const weatherValue = (level: SpaceWeatherLevel) =>
  level === "QUIET" ? 92 : level === "ELEVATED" ? 68 : level === "ACTIVE" ? 45 : level === "SEVERE" ? 20 : 50;

/** Sample site geometry across a window centred on `date`. */
export function sampleWindow(
  date: Date,
  lat: number,
  lon: number,
  elevationM: number,
  spanHours: number,
  steps = 120,
  enabledRelays?: Set<string>,
): SamplePoint[] {
  const out: SamplePoint[] = [];
  const startMs = date.getTime() - (spanHours / 2) * 3600 * 1000;
  for (let i = 0; i <= steps; i++) {
    const time = new Date(startMs + (i / steps) * spanHours * 3600 * 1000);
    const s = skyState(time, lat, lon, elevationM);
    const linkedIds = relayStates(time, lat, lon, elevationM, enabledRelays)
      .filter((r) => r.linkAvailable)
      .map((r) => r.relay.id);
    const links = linkedIds.length;
    out.push({
      time,
      sunElevation: s.sun.elevation,
      earthElevation: s.earth.elevation,
      relayLinks: links,
      relayIds: linkedIds,
    });
  }
  return out;
}

const fraction = (samples: SamplePoint[], pick: (s: SamplePoint) => boolean) =>
  samples.length ? samples.filter(pick).length / samples.length : 0;

/** Duration until the Earth-visibility state flips, measured forward in time. */
export function dteWindow(date: Date, lat: number, lon: number, elevationM: number) {
  const state = skyState(date, lat, lon, elevationM).earthVisible;
  const stepMinutes = 10;
  const maxHours = 24 * 30;
  for (let m = stepMinutes; m <= maxHours * 60; m += stepMinutes) {
    const t = new Date(date.getTime() + m * 60000);
    if (skyState(t, lat, lon, elevationM).earthVisible !== state) {
      return {
        state: (state ? "AVAILABLE" : "BLOCKED") as "AVAILABLE" | "BLOCKED",
        hours: m / 60,
      };
    }
  }
  return { state: (state ? "AVAILABLE" : "BLOCKED") as "AVAILABLE" | "BLOCKED", hours: Infinity };
}

/** Contiguous windows where a predicate holds. */
export function extractWindows(
  samples: SamplePoint[],
  pick: (s: SamplePoint) => boolean,
): Window[] {
  const windows: Window[] = [];
  let start: Date | null = null;
  samples.forEach((s, i) => {
    const ok = pick(s);
    if (ok && !start) start = s.time;
    const last = i === samples.length - 1;
    if (start && (!ok || last)) {
      const end = ok && last ? s.time : samples[i]!.time;
      windows.push({
        start,
        end,
        hours: (end.getTime() - start.getTime()) / 3600000,
      });
      start = null;
    }
  });
  return windows.filter((w) => w.hours > 0);
}

export function analyseSite(opts: {
  site: LunarSite | (Omit<LunarSite, "id"> & { name: string });
  date: Date;
  spanHours?: number;
  weather: SpaceWeatherLevel;
  weights?: Weights;
  enabledRelays?: Set<string>;
  steps?: number;
}): SiteAnalysis {
  const { site, date, weather } = opts;
  const spanHours = opts.spanHours ?? 24;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const now = skyState(date, site.lat, site.lon, site.elevationM);
  const relays = relayStates(date, site.lat, site.lon, site.elevationM, opts.enabledRelays);
  const linked = relays.filter((r) => r.linkAvailable);
  const bestRelay =
    linked.slice().sort((a, b) => b.elevation - a.elevation)[0] ??
    relays.slice().sort((a, b) => b.elevation - a.elevation)[0] ??
    null;

  const samples = sampleWindow(
    date,
    site.lat,
    site.lon,
    site.elevationM,
    spanHours,
    opts.steps ?? 96,
    opts.enabledRelays,
  );

  const sunlitFraction = fraction(samples, (s) => s.sunElevation > 0);
  const earthVisibleFraction = fraction(samples, (s) => s.earthElevation > 0);
  const relayFraction = fraction(samples, (s) => s.relayLinks > 0);

  // Terrain: penalise slope, relief and roughness.
  const terrain = clamp(
    100 - site.meanSlope * 4.5 - Math.max(0, site.maxSlope - 15) * 2.2 - site.roughness * 35,
  );
  // Illumination: current Sun elevation plus sunlit duty cycle over the window.
  const illumination = clamp(
    55 * sunlitFraction + 45 * clamp(now.sun.elevation / 20, 0, 1) + (now.sunlit ? 8 : 0),
  );
  // Communication: DTE availability plus relay continuity.
  const communication = clamp(
    45 * earthVisibleFraction + 35 * relayFraction + (now.earthVisible ? 12 : 0) + (linked.length ? 8 : 0),
  );
  const spaceWeather = weatherValue(weather);
  const confidence = site.terrainConfidence;
  const confScore = confidenceValue(confidence);

  const wSum =
    weights.terrain + weights.illumination + weights.communication + weights.spaceWeather + weights.confidence || 1;
  const overall = Math.round(
    (terrain * weights.terrain +
      illumination * weights.illumination +
      communication * weights.communication +
      spaceWeather * weights.spaceWeather +
      confScore * weights.confidence) /
      wSum,
  );

  const endToEnd: SiteAnalysis["endToEnd"] = now.earthVisible
    ? "DIRECT"
    : linked.length
      ? "AVAILABLE"
      : "GAP";

  return {
    site: {
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      elevationM: site.elevationM,
      meanSlope: site.meanSlope,
      maxSlope: site.maxSlope,
      reliefM: site.reliefM,
      roughness: site.roughness,
      terrainConfidence: site.terrainConfidence,
    },
    now,
    relays,
    bestRelay,
    endToEnd,
    samples,
    sunlitFraction,
    earthVisibleFraction,
    relayFraction,
    currentDteWindow: dteWindow(date, site.lat, site.lon, site.elevationM),
    scores: {
      terrain: Math.round(terrain),
      illumination: Math.round(illumination),
      communication: Math.round(communication),
      spaceWeather: Math.round(spaceWeather),
      confidence,
      overall,
    },
  };
}

export type CheckState = "PASS" | "REVIEW" | "CONSTRAINT" | "DATA_GAP";

export const scoreState = (v: number): CheckState =>
  v >= 75 ? "PASS" : v >= 55 ? "REVIEW" : "CONSTRAINT";

export const planningStatus = (overall: number) =>
  overall >= 70 ? "READY FOR FURTHER REVIEW" : "REQUIRES ATTENTION";
