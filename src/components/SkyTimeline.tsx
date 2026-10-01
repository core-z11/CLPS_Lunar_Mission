import { memo } from "react";
import type { SamplePoint } from "@/lib/mission";

/** Sun / Earth elevation over time, with relay-link band and a cursor. */
export const SkyTimeline = memo(function SkyTimeline({
  samples,
  cursor,
  onPick,
  compact = false,
}: {
  samples: SamplePoint[];
  cursor?: Date;
  onPick?: (d: Date) => void;
  compact?: boolean;
}) {
  const W = 800;
  const H = compact ? 110 : 170;
  const band = 10;
  const elMin = -12;
  const elMax = 16;
  if (!samples.length) return null;
  const t0 = samples[0].time.getTime();
  const t1 = samples[samples.length - 1].time.getTime();
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (el: number) =>
    (H - band - 4) * (1 - (Math.max(elMin, Math.min(elMax, el)) - elMin) / (elMax - elMin));
  const hy = y(0);

  const path = (pick: (s: SamplePoint) => number) =>
    samples.map((s, i) => `${i ? "L" : "M"}${x(s.time.getTime()).toFixed(1)},${y(pick(s)).toFixed(1)}`).join("");
  const area = (pick: (s: SamplePoint) => number) =>
    `${path((s) => Math.max(0, pick(s)))}L${W},${hy}L0,${hy}Z`;

  const spanH = (t1 - t0) / 3600000;
  const ticks = 6;

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 16}`}
      className="h-auto w-full cursor-crosshair select-none"
      onClick={(ev) => {
        if (!onPick) return;
        const rect = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
        const f = (ev.clientX - rect.left) / rect.width;
        onPick(new Date(t0 + f * (t1 - t0)));
      }}
      role="img"
      aria-label="Sun and Earth elevation timeline"
    >
      <rect x={0} y={hy} width={W} height={H - band - 4 - hy} className="fill-shadow-zone" />
      <path d={area((s) => s.sunElevation)} className="fill-sun/15" />
      <path d={path((s) => s.sunElevation)} className="fill-none stroke-sun" strokeWidth={1.8} />
      <path d={path((s) => s.earthElevation)} className="fill-none stroke-earth" strokeWidth={1.8} />
      <line x1={0} x2={W} y1={hy} y2={hy} className="stroke-foreground/50" />
      {[5, 10].map((el) => (
        <line key={el} x1={0} x2={W} y1={y(el)} y2={y(el)} className="stroke-grid" strokeDasharray="2 5" />
      ))}
      {/* Relay band */}
      {samples.slice(1).map((s, i) => (
        <rect
          key={i}
          x={x(samples[i].time.getTime())}
          y={H - band}
          width={Math.max(0.5, x(s.time.getTime()) - x(samples[i].time.getTime()))}
          height={band}
          className={s.relayLinks > 0 ? "fill-relay/70" : "fill-critical/40"}
        />
      ))}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const t = t0 + (i / ticks) * (t1 - t0);
        const d = new Date(t);
        const label =
          spanH <= 48
            ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
            : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
        return (
          <text
            key={i}
            x={Math.min(W - 18, Math.max(16, x(t)))}
            y={H + 13}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            {label}
          </text>
        );
      })}
      {cursor && (
        <line
          x1={x(cursor.getTime())}
          x2={x(cursor.getTime())}
          y1={0}
          y2={H}
          className="stroke-foreground"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
});
