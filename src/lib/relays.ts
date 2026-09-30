/**
 * SIMULATED lunar relay constellation (reference architecture).
 *
 * Inspired by publicly described LunaNet / LCRNS concepts but NOT operational
 * orbit data. Every value here is a simulation and must be labelled as such in
 * the interface.
 */

import {
  DEG,
  MOON_RADIUS_KM,
  clearsMoon,
  cross,
  dot,
  fromBodyFrame,
  horizonFromBodyVector,
  julianDay,
  moonPositionKm,
  scale,
  siteFrame,
  toBodyFrame,
  unit,
  type V3,
} from "./astro";

const GM_MOON = 4902.8; // km^3/s^2

export type RelayKind = "SIMULATED" | "PLANNED" | "REAL";

export interface RelayDef {
  id: string;
  name: string;
  kind: RelayKind;
  /** Semi-major axis, km (circular approximation). */
  semiMajorKm: number;
  inclinationDeg: number;
  raanDeg: number;
  /** Phase at J2000 epoch, deg. */
  phaseDeg: number;
  note: string;
}

export const RELAYS: RelayDef[] = [
  {
    id: "relay-a",
    name: "Relay A",
    kind: "SIMULATED",
    semiMajorKm: MOON_RADIUS_KM + 3000,
    inclinationDeg: 57,
    raanDeg: 10,
    phaseDeg: 0,
    note: "Reference constellation plane 1 — simulation only.",
  },
  {
    id: "relay-b",
    name: "Relay B",
    kind: "SIMULATED",
    semiMajorKm: MOON_RADIUS_KM + 3000,
    inclinationDeg: 57,
    raanDeg: 10,
    phaseDeg: 120,
    note: "Reference constellation plane 1 — simulation only.",
  },
  {
    id: "relay-c",
    name: "Relay C",
    kind: "SIMULATED",
    semiMajorKm: MOON_RADIUS_KM + 5500,
    inclinationDeg: 82,
    raanDeg: 95,
    phaseDeg: 45,
    note: "High-inclination plane for south-polar dwell — simulation only.",
  },
  {
    id: "relay-d",
    name: "Relay D",
    kind: "SIMULATED",
    semiMajorKm: MOON_RADIUS_KM + 5500,
    inclinationDeg: 82,
    raanDeg: 95,
    phaseDeg: 185,
    note: "High-inclination plane for south-polar dwell — simulation only.",
  },
  {
    id: "relay-e",
    name: "Relay E",
    kind: "SIMULATED",
    semiMajorKm: MOON_RADIUS_KM + 8500,
    inclinationDeg: 70,
    raanDeg: 200,
    phaseDeg: 300,
    note: "Long-dwell outer plane — simulation only.",
  },
];

export const relayPeriodHours = (r: RelayDef) =>
  (2 * Math.PI * Math.sqrt(r.semiMajorKm ** 3 / GM_MOON)) / 3600;

/** Relay position in the Moon body-fixed frame, km. */
export function relayPositionBody(r: RelayDef, date: Date): V3 {
  const jd = julianDay(date);
  const n = Math.sqrt(GM_MOON / r.semiMajorKm ** 3); // rad/s
  const secondsSinceEpoch = (jd - 2451545.0) * 86400;
  const theta = r.phaseDeg * DEG + n * secondsSinceEpoch;

  // Orbit plane basis in the (inertial) equatorial frame.
  const raan = r.raanDeg * DEG;
  const inc = r.inclinationDeg * DEG;
  const nodeVec: V3 = [Math.cos(raan), Math.sin(raan), 0];
  const polar: V3 = unit([
    Math.sin(inc) * Math.sin(raan),
    -Math.sin(inc) * Math.cos(raan),
    Math.cos(inc),
  ]);
  const inPlane = unit(cross(polar, nodeVec));
  const posInertial: V3 = [
    r.semiMajorKm * (nodeVec[0] * Math.cos(theta) + inPlane[0] * Math.sin(theta)),
    r.semiMajorKm * (nodeVec[1] * Math.cos(theta) + inPlane[1] * Math.sin(theta)),
    r.semiMajorKm * (nodeVec[2] * Math.cos(theta) + inPlane[2] * Math.sin(theta)),
  ];
  return toBodyFrame(posInertial, jd);
}

export interface RelayState {
  relay: RelayDef;
  /** Body-frame position, km. */
  position: V3;
  /** Sub-satellite selenographic point. */
  subLat: number;
  subLon: number;
  altitudeKm: number;
  /** Elevation above site horizon, deg. */
  elevation: number;
  azimuth: number;
  rangeKm: number;
  siteVisible: boolean;
  earthVisible: boolean;
  linkAvailable: boolean;
}

export const RELAY_MASK_DEG = 5;

export function relayState(
  r: RelayDef,
  date: Date,
  lat: number,
  lon: number,
  elevationM = 0,
): RelayState {
  const jd = julianDay(date);
  const pos = relayPositionBody(r, date);
  const radius = MOON_RADIUS_KM + elevationM / 1000;
  const h = horizonFromBodyVector(pos, lat, lon, radius);
  const earthBody = toBodyFrame(scale(moonPositionKm(jd), -1), jd);
  const earthVisible = clearsMoon(pos, earthBody);
  const siteVisible = h.elevation > RELAY_MASK_DEG;
  const u = unit(pos);
  return {
    relay: r,
    position: pos,
    subLat: Math.asin(u[2]) / DEG,
    subLon: Math.atan2(u[1], u[0]) / DEG,
    altitudeKm: Math.sqrt(dot(pos, pos)) - MOON_RADIUS_KM,
    elevation: h.elevation,
    azimuth: h.azimuth,
    rangeKm: h.range,
    siteVisible,
    earthVisible,
    linkAvailable: siteVisible && earthVisible,
  };
}

export function relayStates(
  date: Date,
  lat: number,
  lon: number,
  elevationM = 0,
  enabled?: Set<string>,
): RelayState[] {
  return RELAYS.filter((r) => !enabled || enabled.has(r.id)).map((r) =>
    relayState(r, date, lat, lon, elevationM),
  );
}

/** Ground track of a relay over one orbital period (selenographic lat/lon). */
export function relayGroundTrack(r: RelayDef, date: Date, samples = 180) {
  const periodMs = relayPeriodHours(r) * 3600 * 1000;
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = new Date(date.getTime() + (i / samples) * periodMs);
    const u = unit(relayPositionBody(r, t));
    out.push({ lat: Math.asin(u[2]) / DEG, lon: (Math.atan2(u[1], u[0]) / DEG) });
  }
  return out;
}

/** Convenience: relay position expressed in the equatorial frame (for 3D views). */
export const relayPositionInertial = (r: RelayDef, date: Date) =>
  fromBodyFrame(relayPositionBody(r, date), julianDay(date));

export const siteUpVector = (lat: number, lon: number) => siteFrame(lat, lon).up;
