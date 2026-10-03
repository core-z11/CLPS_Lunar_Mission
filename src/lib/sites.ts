/**
 * Candidate lunar south-pole study sites.
 *
 * Coordinates are approximate published locations of well-documented
 * south-polar features (LRO/LOLA-derived literature values). Terrain
 * descriptors are planning-level estimates for this prototype and are NOT
 * engineering products. Each site is a CANDIDATE for analysis only.
 */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface LunarSite {
  id: string;
  name: string;
  /** Selenographic latitude, degrees (negative = south). */
  lat: number;
  /** Selenographic longitude, degrees east. */
  lon: number;
  /** Approximate elevation relative to the 1737.4 km reference sphere, metres. */
  elevationM: number;
  /** Mean local slope over a 500 m zone, degrees (estimate). */
  meanSlope: number;
  /** Maximum local slope over a 500 m zone, degrees (estimate). */
  maxSlope: number;
  /** Local relief across the zone, metres (estimate). */
  reliefM: number;
  /** 0-1 roughness indicator (estimate). */
  roughness: number;
  terrainConfidence: Confidence;
  notes: string;
}

export const LUNAR_SITES: LunarSite[] = [
  {
    id: "shackleton-rim",
    name: "Shackleton Crater — connecting ridge",
    lat: -89.44,
    lon: 137.0,
    elevationM: 1600,
    meanSlope: 6.2,
    maxSlope: 14.8,
    reliefM: 95,
    roughness: 0.34,
    terrainConfidence: "HIGH",
    notes: "High-illumination ridge segment between Shackleton and de Gerlache.",
  },
  {
    id: "de-gerlache-rim",
    name: "de Gerlache Crater — north rim",
    lat: -88.5,
    lon: -87.1,
    elevationM: 1150,
    meanSlope: 8.1,
    maxSlope: 19.4,
    reliefM: 140,
    roughness: 0.45,
    terrainConfidence: "MEDIUM",
    notes: "Adjacent to permanently shadowed interior; strong thermal gradients.",
  },
  {
    id: "malapert-massif",
    name: "Malapert Massif",
    lat: -85.99,
    lon: 2.93,
    elevationM: 5000,
    meanSlope: 5.4,
    maxSlope: 16.2,
    reliefM: 120,
    roughness: 0.3,
    terrainConfidence: "HIGH",
    notes: "Elevated massif with long direct-to-Earth visibility fractions.",
  },
  {
    id: "cabeus-a",
    name: "Cabeus Crater — floor approach",
    lat: -84.9,
    lon: -35.5,
    elevationM: -3000,
    meanSlope: 4.1,
    maxSlope: 11.0,
    reliefM: 70,
    roughness: 0.28,
    terrainConfidence: "MEDIUM",
    notes: "Volatile-rich cold trap region; extended shadowing expected.",
  },
  {
    id: "amundsen-rim",
    name: "Amundsen Crater — rim plateau",
    lat: -84.3,
    lon: 82.8,
    elevationM: 900,
    meanSlope: 3.6,
    maxSlope: 9.8,
    reliefM: 55,
    roughness: 0.22,
    terrainConfidence: "HIGH",
    notes: "Relatively flat rim terrain with periodic illumination.",
  },
  {
    id: "haworth-ridge",
    name: "Haworth ridge",
    lat: -87.45,
    lon: -2.1,
    elevationM: 1400,
    meanSlope: 9.3,
    maxSlope: 22.5,
    reliefM: 185,
    roughness: 0.52,
    terrainConfidence: "LOW",
    notes: "Complex terrain; limited high-resolution coverage in this prototype.",
  },
  {
    id: "spudis-ridge",
    name: "Nobile region — ridge segment",
    lat: -85.35,
    lon: 31.6,
    elevationM: 1750,
    meanSlope: 6.9,
    maxSlope: 17.1,
    reliefM: 110,
    roughness: 0.38,
    terrainConfidence: "MEDIUM",
    notes: "Candidate region studied for polar volatile access traverses.",
  },
];

export const findSite = (id: string) => LUNAR_SITES.find((s) => s.id === id) ?? LUNAR_SITES[0]!;

export interface CustomSite {
  id: "custom";
  name: string;
  lat: number;
  lon: number;
}

/** Terrain fields used by the assessment for a manually entered point. */
export function syntheticTerrain(lat: number, lon: number): Omit<LunarSite, "id" | "name"> {
  // Deterministic pseudo-terrain so manual points stay reproducible, with an
  // explicitly LOW confidence label.
  const seed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453) % 1;
  return {
    lat,
    lon,
    elevationM: Math.round((seed - 0.5) * 6000),
    meanSlope: 3 + seed * 9,
    maxSlope: 9 + seed * 16,
    reliefM: Math.round(50 + seed * 180),
    roughness: 0.2 + seed * 0.4,
    terrainConfidence: "LOW",
    notes: "Manually entered coordinate — terrain values are modelled, not measured.",
  };
}
