/**
 * Lunar-surface ephemeris utilities.
 *
 * Analytic (series-truncated) implementations of:
 *  - Solar geocentric position (low-precision Meeus, ~0.01 deg)
 *  - Lunar geocentric position (truncated ELP/Meeus ch.47, ~0.02 deg / ~100 km)
 *  - IAU/WGCCRE 2009 lunar body-fixed rotation (includes physical libration terms)
 *  - Topocentric altitude/azimuth of Sun, Earth and orbiting relays for a
 *    selenographic site.
 *
 * Accuracy is adequate for planning-level visualisation, NOT for navigation.
 */

export const DEG = Math.PI / 180;
export const MOON_RADIUS_KM = 1737.4;
const AU_KM = 149597870.7;

export type V3 = readonly [number, number, number];

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: V3) => Math.sqrt(dot(a, a));
export const unit = (a: V3): V3 => {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
export const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

export const julianDay = (date: Date) => date.getTime() / 86400000 + 2440587.5;
const daysSinceJ2000 = (jd: number) => jd - 2451545.0;
const sinD = (x: number) => Math.sin(x * DEG);
const cosD = (x: number) => Math.cos(x * DEG);
export const wrap360 = (x: number) => ((x % 360) + 360) % 360;

/** Obliquity of the ecliptic (deg). */
const obliquity = (t: number) => 23.439291 - 0.0130042 * t;

const eclipticToEquatorial = (v: V3, t: number): V3 => {
  const e = obliquity(t) * DEG;
  return [v[0], v[1] * Math.cos(e) - v[2] * Math.sin(e), v[1] * Math.sin(e) + v[2] * Math.cos(e)];
};

/** Geocentric Sun position in J2000-ish equatorial frame, km. */
export function sunPositionKm(jd: number): V3 {
  const n = daysSinceJ2000(jd);
  const t = n / 36525;
  const L = 280.46 + 0.9856474 * n;
  const g = 357.528 + 0.9856003 * n;
  const lambda = L + 1.915 * sinD(g) + 0.02 * sinD(2 * g);
  const r = (1.00014 - 0.01671 * cosD(g) - 0.00014 * cosD(2 * g)) * AU_KM;
  return eclipticToEquatorial([r * cosD(lambda), r * sinD(lambda), 0], t);
}

/** Geocentric Moon position in J2000-ish equatorial frame, km. */
export function moonPositionKm(jd: number): V3 {
  const t = daysSinceJ2000(jd) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * t;
  const D = 297.8501921 + 445267.1114034 * t;
  const M = 357.5291092 + 35999.0502909 * t;
  const Mp = 134.9633964 + 477198.8675055 * t;
  const F = 93.272095 + 483202.0175233 * t;

  const lambda =
    Lp +
    6.289 * sinD(Mp) +
    1.274 * sinD(2 * D - Mp) +
    0.658 * sinD(2 * D) +
    0.214 * sinD(2 * Mp) -
    0.186 * sinD(M) -
    0.114 * sinD(2 * F) +
    0.059 * sinD(2 * D - 2 * Mp) +
    0.057 * sinD(2 * D - M - Mp) +
    0.053 * sinD(2 * D + Mp) +
    0.046 * sinD(2 * D - M) -
    0.041 * sinD(M - Mp) -
    0.035 * sinD(D) -
    0.031 * sinD(M + Mp);

  const beta =
    5.128 * sinD(F) +
    0.281 * sinD(Mp + F) +
    0.278 * sinD(Mp - F) +
    0.173 * sinD(2 * D - F) +
    0.055 * sinD(2 * D - Mp + F) +
    0.046 * sinD(2 * D - Mp - F) +
    0.033 * sinD(2 * D + F) +
    0.017 * sinD(2 * Mp + F);

  const dist =
    385000.56 -
    20905.355 * cosD(Mp) -
    3699.111 * cosD(2 * D - Mp) -
    2955.968 * cosD(2 * D) -
    569.925 * cosD(2 * Mp) +
    246.158 * cosD(2 * D - 2 * Mp) -
    204.586 * cosD(2 * D - M) -
    170.733 * cosD(2 * D + Mp);

  const ecl: V3 = [
    dist * cosD(beta) * cosD(lambda),
    dist * cosD(beta) * sinD(lambda),
    dist * sinD(beta),
  ];
  return eclipticToEquatorial(ecl, t);
}

/**
 * Moon body-fixed frame (IAU/WGCCRE 2009 rotation model, truncated E-terms).
 * Returns orthonormal basis vectors expressed in the equatorial frame.
 */
export function moonFrame(jd: number) {
  const d = daysSinceJ2000(jd);
  const t = d / 36525;
  const E = [
    125.045 - 0.0529921 * d,
    250.089 - 0.1059842 * d,
    260.008 + 13.0120009 * d,
    176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d,
    311.589 + 26.4057084 * d,
    134.963 + 13.064993 * d,
    276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d,
    15.134 - 0.1589763 * d,
    119.743 + 0.0036096 * d,
    239.961 + 0.1643573 * d,
    25.053 + 12.9590088 * d,
  ];
  const s = (i: number) => sinD(E[i - 1]!);
  const c = (i: number) => cosD(E[i - 1]!);

  const ra =
    269.9949 +
    0.0031 * t -
    3.8787 * s(1) -
    0.1204 * s(2) +
    0.07 * s(3) -
    0.0172 * s(4) +
    0.0072 * s(6) -
    0.0052 * s(10) +
    0.0043 * s(13);
  const dec =
    66.5392 +
    0.013 * t +
    1.5419 * c(1) +
    0.0239 * c(2) -
    0.0278 * c(3) +
    0.0068 * c(4) -
    0.0029 * c(6) +
    0.0009 * c(7) +
    0.0008 * c(10) -
    0.0009 * c(13);
  const W =
    38.3213 +
    13.17635815 * d -
    1.4e-12 * d * d +
    3.561 * s(1) +
    0.1208 * s(2) -
    0.0642 * s(3) +
    0.0158 * s(4) +
    0.0252 * s(5) -
    0.0066 * s(6) -
    0.0047 * s(7) -
    0.0046 * s(8) +
    0.0028 * s(9) +
    0.0052 * s(10) +
    0.004 * s(11) +
    0.0019 * s(12) -
    0.0044 * s(13);

  const z: V3 = [cosD(dec) * cosD(ra), cosD(dec) * sinD(ra), sinD(dec)];
  // Node of the body equator on the equatorial plane (RA = ra + 90 deg).
  const node: V3 = [cosD(ra + 90), sinD(ra + 90), 0];
  const y0 = cross(z, node);
  const w = wrap360(W) * DEG;
  const x: V3 = unit([
    node[0] * Math.cos(w) + y0[0] * Math.sin(w),
    node[1] * Math.cos(w) + y0[1] * Math.sin(w),
    node[2] * Math.cos(w) + y0[2] * Math.sin(w),
  ]);
  const y = unit(cross(z, x));
  return { x, y, z: unit(z) };
}

/** Rotate an equatorial-frame vector into the Moon body-fixed frame. */
export function toBodyFrame(v: V3, jd: number): V3 {
  const f = moonFrame(jd);
  return [dot(v, f.x), dot(v, f.y), dot(v, f.z)];
}

/** Rotate a Moon body-fixed vector into the equatorial frame. */
export function fromBodyFrame(v: V3, jd: number): V3 {
  const f = moonFrame(jd);
  return [
    v[0] * f.x[0] + v[1] * f.y[0] + v[2] * f.z[0],
    v[0] * f.x[1] + v[1] * f.y[1] + v[2] * f.z[1],
    v[0] * f.x[2] + v[1] * f.y[2] + v[2] * f.z[2],
  ];
}

/** Local up / east / north unit vectors (body frame) for a selenographic site. */
export function siteFrame(latDeg: number, lonDeg: number) {
  const up: V3 = [cosD(latDeg) * cosD(lonDeg), cosD(latDeg) * sinD(lonDeg), sinD(latDeg)];
  const east: V3 = unit([-sinD(lonDeg), cosD(lonDeg), 0]);
  const north = unit(cross(up, east));
  return { up, east, north };
}

export interface HorizonCoords {
  /** Altitude above the local (spherical) horizon, degrees. */
  elevation: number;
  /** Azimuth measured clockwise from local north, degrees. */
  azimuth: number;
  /** Distance to the target, km. */
  range: number;
}

/** Altitude/azimuth of a body-frame direction as seen from a site. */
export function horizonFromBodyVector(
  targetBody: V3,
  latDeg: number,
  lonDeg: number,
  siteRadiusKm = MOON_RADIUS_KM,
): HorizonCoords {
  const { up, east, north } = siteFrame(latDeg, lonDeg);
  const sitePos = scale(up, siteRadiusKm);
  const d = sub(targetBody, sitePos);
  const range = norm(d);
  const u = unit(d);
  return {
    elevation: Math.asin(Math.max(-1, Math.min(1, dot(u, up)))) / DEG,
    azimuth: wrap360(Math.atan2(dot(u, east), dot(u, north)) / DEG),
    range,
  };
}

export interface SkyState {
  jd: number;
  sun: HorizonCoords;
  earth: HorizonCoords;
  /** Sun-Earth-Moon phase-independent illumination flag. */
  sunlit: boolean;
  earthVisible: boolean;
}

/** Core geometry for a site at an instant. */
export function skyState(date: Date, latDeg: number, lonDeg: number, elevationM = 0): SkyState {
  const jd = julianDay(date);
  const rMoon = moonPositionKm(jd);
  const rSun = sunPositionKm(jd);
  const moonToEarth = toBodyFrame(scale(rMoon, -1), jd);
  const moonToSun = toBodyFrame(sub(rSun, rMoon), jd);
  const radius = MOON_RADIUS_KM + elevationM / 1000;
  const sun = horizonFromBodyVector(moonToSun, latDeg, lonDeg, radius);
  const earth = horizonFromBodyVector(moonToEarth, latDeg, lonDeg, radius);
  return { jd, sun, earth, sunlit: sun.elevation > 0, earthVisible: earth.elevation > 0 };
}

/** Sub-Earth selenographic point (optical + physical libration). */
export function subEarthPoint(date: Date) {
  const jd = julianDay(date);
  const v = unit(toBodyFrame(scale(moonPositionKm(jd), -1), jd));
  return {
    lat: Math.asin(v[2]) / DEG,
    lon: Math.atan2(v[1], v[0]) / DEG,
  };
}

/** Sub-solar selenographic point. */
export function subSolarPoint(date: Date) {
  const jd = julianDay(date);
  const v = unit(toBodyFrame(sub(sunPositionKm(jd), moonPositionKm(jd)), jd));
  return {
    lat: Math.asin(v[2]) / DEG,
    lon: Math.atan2(v[1], v[0]) / DEG,
  };
}

/**
 * Does the segment from `a` to `b` (both Moon body frame, km) clear the lunar
 * sphere? Used for relay -> Earth line-of-sight occultation checks.
 */
export function clearsMoon(a: V3, b: V3, radiusKm = MOON_RADIUS_KM): boolean {
  const ab = sub(b, a);
  const len2 = dot(ab, ab) || 1;
  let s = -dot(a, ab) / len2;
  s = Math.max(0, Math.min(1, s));
  const closest: V3 = [a[0] + ab[0] * s, a[1] + ab[1] * s, a[2] + ab[2] * s];
  return norm(closest) >= radiusKm;
}

export const formatDeg = (v: number, digits = 1) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}°`;

export const formatAz = (v: number) => `${wrap360(v).toFixed(0)}°`;

export const formatDuration = (hours: number) => {
  if (!isFinite(hours) || hours <= 0) return "0h 00m";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

/** Unit directions (Moon body frame) from the Moon centre to the Sun and Earth. */
export function bodyDirections(date: Date) {
  const jd = julianDay(date);
  const rMoon = moonPositionKm(jd);
  return {
    sun: unit(toBodyFrame(sub(sunPositionKm(jd), rMoon), jd)),
    earth: unit(toBodyFrame(scale(rMoon, -1), jd)),
  };
}
