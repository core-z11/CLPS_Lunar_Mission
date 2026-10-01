import { memo } from "react";
import { formatDeg } from "@/lib/astro";
import type { RelayState } from "@/lib/relays";

interface Body {
  elevation: number;
  azimuth: number;
}

const SIZE = 360;
const C = SIZE / 2;
const RH = 140; // horizon ring radius

/** Elevation → radius. Log scale emphasises the low angles that dominate polar sites. */
function radiusFor(el: number) {
  if (el >= 0) return RH * (1 - Math.log1p(el) / Math.log1p(90));
  return Math.min(RH + 30, RH + (-el / 15) * 30);
}

function project(b: Body) {
  const r = radiusFor(b.elevation);
  const a = (b.azimuth * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

export const LocalSky = memo(function LocalSky({
  sun,
  earth,
  relays,
}: {
  sun: Body;
  earth: Body;
  relays: RelayState[];
}) {
  const s = project(sun);
  const e = project(earth);
  const rings = [0, 2, 5, 10, 30];

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full" role="img" aria-label="Local sky view">
      <circle cx={C} cy={C} r={RH + 30} className="fill-shadow-zone" />
      <circle cx={C} cy={C} r={RH} className="fill-background stroke-foreground/50" strokeWidth={1.2} />
      {rings.slice(1).map((el) => (
        <g key={el}>
          <circle cx={C} cy={C} r={radiusFor(el)} className="fill-none stroke-grid" strokeDasharray="2 4" />
          <text x={C + 3} y={C - radiusFor(el) - 3} className="fill-muted-foreground font-mono text-[9px]">
            {el}°
          </text>
        </g>
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={C}
            y1={C}
            x2={C + RH * Math.sin(a)}
            y2={C - RH * Math.cos(a)}
            className="stroke-grid"
          />
        );
      })}
      {[
        ["N", 0],
        ["E", 90],
        ["S", 180],
        ["W", 270],
      ].map(([l, az]) => {
        const a = ((az as number) * Math.PI) / 180;
        return (
          <text
            key={l}
            x={C + (RH + 18) * Math.sin(a)}
            y={C - (RH + 18) * Math.cos(a) + 4}
            textAnchor="middle"
            className="fill-foreground font-mono text-[11px]"
          >
            {l}
          </text>
        );
      })}
      <text x={C} y={C + RH + 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
        HORIZON
      </text>

      {relays.map((r) => {
        const p = project(r);
        const tone = r.linkAvailable ? "fill-relay" : r.siteVisible ? "fill-caution" : "fill-unknown";
        return (
          <g key={r.relay.id} opacity={r.elevation < -15 ? 0.25 : 1}>
            <rect x={p.x - 3.5} y={p.y - 3.5} width={7} height={7} className={tone} transform={`rotate(45 ${p.x} ${p.y})`} />
            <text x={p.x + 7} y={p.y + 3} className="fill-relay font-mono text-[9px]">
              {r.relay.name.replace("Relay ", "R")}
            </text>
          </g>
        );
      })}

      {/* Sun */}
      <line x1={C} y1={C} x2={s.x} y2={s.y} className="stroke-sun/60" strokeDasharray="3 3" />
      <circle cx={s.x} cy={s.y} r={9} className={sun.elevation > 0 ? "fill-sun" : "fill-sun/30 stroke-sun"} />
      <text x={s.x} y={s.y - 14} textAnchor="middle" className="fill-sun font-mono text-[10px]">
        SUN {formatDeg(sun.elevation)}
      </text>

      {/* Earth */}
      <line x1={C} y1={C} x2={e.x} y2={e.y} className="stroke-earth/60" strokeDasharray="3 3" />
      <circle cx={e.x} cy={e.y} r={8} className={earth.elevation > 0 ? "fill-earth" : "fill-earth/25 stroke-earth"} />
      <text x={e.x} y={e.y + 20} textAnchor="middle" className="fill-earth font-mono text-[10px]">
        EARTH {formatDeg(earth.elevation)}
      </text>

      <circle cx={C} cy={C} r={3} className="fill-foreground" />
    </svg>
  );
});

/** Panoramic horizon strip: azimuth vs. low elevation band. */
export const HorizonStrip = memo(function HorizonStrip({
  sun,
  earth,
  relays,
}: {
  sun: Body;
  earth: Body;
  relays: RelayState[];
}) {
  const W = 720;
  const H = 120;
  const elMin = -10;
  const elMax = 20;
  const x = (az: number) => (az / 360) * W;
  const y = (el: number) => H - ((Math.max(elMin, Math.min(elMax, el)) - elMin) / (elMax - elMin)) * H;
  const hy = y(0);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label="Horizon panorama">
      <rect x={0} y={hy} width={W} height={H - hy} className="fill-shadow-zone" />
      <line x1={0} x2={W} y1={hy} y2={hy} className="stroke-foreground/60" />
      {[5, 10, 15].map((el) => (
        <line key={el} x1={0} x2={W} y1={y(el)} y2={y(el)} className="stroke-grid" strokeDasharray="2 5" />
      ))}
      {[0, 90, 180, 270, 360].map((az) => (
        <text key={az} x={Math.min(W - 10, Math.max(8, x(az)))} y={H + 13} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
          {["N", "E", "S", "W", "N"][az / 90]}
        </text>
      ))}
      {relays.map((r) => (
        <rect
          key={r.relay.id}
          x={x(r.azimuth) - 3}
          y={y(r.elevation) - 3}
          width={6}
          height={6}
          className={r.linkAvailable ? "fill-relay" : "fill-unknown"}
          opacity={r.elevation > elMax || r.elevation < elMin ? 0.35 : 1}
        />
      ))}
      <circle cx={x(sun.azimuth)} cy={y(sun.elevation)} r={7} className="fill-sun" />
      <circle cx={x(earth.azimuth)} cy={y(earth.elevation)} r={6} className="fill-earth" />
      <text x={6} y={hy - 4} className="fill-muted-foreground font-mono text-[9px]">
        0° LOCAL HORIZON (spherical, no terrain mask)
      </text>
    </svg>
  );
});
