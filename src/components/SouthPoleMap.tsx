import { memo, useMemo } from "react";
import { LUNAR_SITES } from "@/lib/sites";
import type { RelayState } from "@/lib/relays";

const SIZE = 420;
const C = SIZE / 2;
const R = 190;
const LAT_EDGE = -80; // map extent

/** Polar stereographic-like azimuthal projection centred on the south pole.
 *  Longitude 0° (Earth-facing near side) points down. */
export function projectLatLon(lat: number, lon: number) {
  const r = (R * (lat + 90)) / (90 + LAT_EDGE);
  const a = (lon * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C + r * Math.cos(a), inside: lat <= LAT_EDGE };
}

export function unproject(x: number, y: number) {
  const dx = x - C;
  const dy = y - C;
  const r = Math.sqrt(dx * dx + dy * dy);
  const lat = -90 + (r / R) * (90 + LAT_EDGE);
  const lon = (Math.atan2(dx, dy) * 180) / Math.PI;
  return { lat, lon };
}

export const SouthPoleMap = memo(function SouthPoleMap({
  selected,
  sunLon,
  earthLon,
  sunElevation,
  relays,
  radiusKm = 0.5,
  onSelectSite,
  onPickPoint,
  showLinks = true,
}: {
  selected: { lat: number; lon: number; id?: string };
  sunLon: number;
  earthLon: number;
  sunElevation: number;
  relays?: RelayState[];
  radiusKm?: number;
  onSelectSite?: (id: string) => void;
  onPickPoint?: (lat: number, lon: number) => void;
  showLinks?: boolean;
}) {
  const sel = projectLatLon(selected.lat, selected.lon);
  const sa = (sunLon * Math.PI) / 180;
  const ea = (earthLon * Math.PI) / 180;
  const sunDir = { x: Math.sin(sa), y: Math.cos(sa) };
  const earthDir = { x: Math.sin(ea), y: Math.cos(ea) };
  // ~303 km from pole to the -80° ring
  const kmPerPx = 303 / R;
  const zonePx = Math.max(3, radiusKm / kmPerPx);

  // Pseudo-relief: deterministic crater field for visual context only.
  const craters = useMemo(() => {
    const out: { x: number; y: number; r: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const rr = Math.sqrt(rnd()) * R * 0.98;
      const a = rnd() * Math.PI * 2;
      out.push({ x: C + rr * Math.sin(a), y: C + rr * Math.cos(a), r: 2 + rnd() ** 2 * 18 });
    }
    return out;
  }, []);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full"
      role="img"
      aria-label="Lunar south pole map"
      onClick={(ev) => {
        if (!onPickPoint) return;
        const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * SIZE;
        const py = ((ev.clientY - rect.top) / rect.height) * SIZE;
        const p = unproject(px, py);
        if (p.lat <= LAT_EDGE) onPickPoint(p.lat, p.lon);
      }}
    >
      <defs>
        <radialGradient id="moonShade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--regolith)" />
          <stop offset="100%" stopColor="var(--secondary)" />
        </radialGradient>
        <linearGradient
          id="sunlight"
          x1={0.5 - sunDir.x / 2}
          y1={0.5 - sunDir.y / 2}
          x2={0.5 + sunDir.x / 2}
          y2={0.5 + sunDir.y / 2}
        >
          <stop offset="0%" stopColor="var(--shadow-zone)" stopOpacity={0.85} />
          <stop offset="55%" stopColor="var(--shadow-zone)" stopOpacity={sunElevation > 0 ? 0.25 : 0.6} />
          <stop offset="100%" stopColor="var(--sun)" stopOpacity={0.12} />
        </linearGradient>
        <clipPath id="disk">
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <circle cx={C} cy={C} r={R} fill="url(#moonShade)" />
      <g clipPath="url(#disk)">
        {craters.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r} className="fill-shadow-zone/40 stroke-foreground/10" />
        ))}
        {LUNAR_SITES.slice(0, 2).map((s) => {
          const p = projectLatLon(s.lat, s.lon);
          return <circle key={s.id + "c"} cx={p.x} cy={p.y} r={10.5 / kmPerPx * 1.6} className="fill-shadow-zone/70" />;
        })}
        <rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#sunlight)" />
        {[-82, -84, -86, -88].map((lat) => (
          <circle key={lat} cx={C} cy={C} r={projectLatLon(lat, 0).y - C} className="fill-none stroke-grid" strokeDasharray="2 4" />
        ))}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((lon) => {
          const p = projectLatLon(LAT_EDGE, lon);
          return <line key={lon} x1={C} y1={C} x2={p.x} y2={p.y} className="stroke-grid" />;
        })}
      </g>
      <circle cx={C} cy={C} r={R} className="fill-none stroke-foreground/30" />

      {[
        ["0°", 0],
        ["90°E", 90],
        ["180°", 180],
        ["90°W", -90],
      ].map(([l, lon]) => {
        const p = projectLatLon(-79.2, lon as number);
        return (
          <text key={l} x={p.x} y={p.y + 3} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            {l}
          </text>
        );
      })}

      {/* Sun and Earth direction indicators at the map edge */}
      <g>
        <line x1={C} y1={C} x2={C + sunDir.x * (R + 4)} y2={C + sunDir.y * (R + 4)} className="stroke-sun/50" strokeDasharray="4 4" />
        <circle cx={C + sunDir.x * (R + 12)} cy={C + sunDir.y * (R + 12)} r={7} className="fill-sun" />
        <line x1={C} y1={C} x2={C + earthDir.x * (R + 4)} y2={C + earthDir.y * (R + 4)} className="stroke-earth/50" strokeDasharray="4 4" />
        <circle cx={C + earthDir.x * (R + 12)} cy={C + earthDir.y * (R + 12)} r={6} className="fill-earth" />
      </g>

      {/* Relay sub-satellite points */}
      {relays?.map((r) => {
        const p = projectLatLon(r.subLat, r.subLon);
        if (!p.inside) return null;
        return (
          <g key={r.relay.id}>
            {showLinks && r.linkAvailable && (
              <line x1={sel.x} y1={sel.y} x2={p.x} y2={p.y} className="stroke-relay/70" strokeDasharray="3 3" />
            )}
            <rect x={p.x - 3} y={p.y - 3} width={6} height={6} className="fill-relay" transform={`rotate(45 ${p.x} ${p.y})`} />
          </g>
        );
      })}

      {LUNAR_SITES.map((s) => {
        const p = projectLatLon(s.lat, s.lon);
        const active = s.id === selected.id;
        return (
          <g
            key={s.id}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSite?.(s.id);
            }}
          >
            <circle cx={p.x} cy={p.y} r={active ? 6 : 4} className={active ? "fill-primary" : "fill-foreground/80"} />
            <text x={p.x + 8} y={p.y + 3} className="fill-foreground/80 text-[9px]">
              {s.name.split(" —")[0]}
            </text>
          </g>
        );
      })}

      {/* Selected landing zone */}
      <circle cx={sel.x} cy={sel.y} r={zonePx + 8} className="fill-none stroke-primary" strokeWidth={1.5} />
      <circle cx={sel.x} cy={sel.y} r={zonePx} className="fill-primary/25 stroke-primary" />
    </svg>
  );
});
