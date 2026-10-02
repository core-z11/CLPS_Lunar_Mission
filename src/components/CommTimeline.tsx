import { memo } from "react";
import type { SamplePoint } from "@/lib/mission";
import { RELAYS } from "@/lib/relays";

/** Lane chart: Sun / Direct Earth / each relay / network, with draggable cursor. */
export const CommTimeline = memo(function CommTimeline({
  samples,
  cursor,
  onPick,
  enabled,
}: {
  samples: SamplePoint[];
  cursor: Date;
  onPick: (d: Date) => void;
  enabled: Set<string>;
}) {
  if (!samples.length) return null;
  const t0 = samples[0].time.getTime();
  const t1 = samples[samples.length - 1].time.getTime();
  const lanes: { label: string; tone: string; on: (s: SamplePoint) => boolean }[] = [
    { label: "SUN", tone: "bg-sun", on: (s) => s.sunElevation > 0 },
    { label: "DIRECT EARTH", tone: "bg-earth", on: (s) => s.earthElevation > 0 },
    ...RELAYS.filter((r) => enabled.has(r.id)).map((r) => ({
      label: r.name.toUpperCase(),
      tone: "bg-relay",
      on: (s: SamplePoint) => s.relayIds.includes(r.id),
    })),
    { label: "NETWORK", tone: "bg-favorable", on: (s) => s.earthElevation > 0 || s.relayLinks > 0 },
  ];
  const pct = ((cursor.getTime() - t0) / (t1 - t0 || 1)) * 100;

  const pickAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onPick(new Date(t0 + f * (t1 - t0)));
  };

  const fmt = (t: number) => {
    const d = new Date(t);
    return t1 - t0 <= 48 * 3600e3
      ? `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
      : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  };

  return (
    <div className="grid grid-cols-[96px_1fr] gap-x-3">
      <div className="space-y-1.5 pt-0.5">
        {lanes.map((l) => (
          <p key={l.label} className="h-3.5 font-mono text-[10px] leading-[14px] text-muted-foreground">
            {l.label}
          </p>
        ))}
      </div>
      <div
        className="relative cursor-ew-resize touch-none select-none"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pickAt(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (e.buttons) pickAt(e.clientX, e.currentTarget);
        }}
      >
        <div className="space-y-1.5 pt-0.5">
          {lanes.map((l) => (
            <div key={l.label} className="flex h-3.5 overflow-hidden rounded-sm bg-muted/60">
              {samples.map((s, i) => (
                <div key={i} className={`h-full flex-1 ${l.on(s) ? l.tone : ""} ${l.on(s) ? "opacity-80" : ""}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute -bottom-1 -top-1 w-px bg-foreground" style={{ left: `${pct}%` }}>
          <span className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-foreground" />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <span key={f}>{fmt(t0 + f * (t1 - t0))}</span>
          ))}
        </div>
      </div>
    </div>
  );
});
