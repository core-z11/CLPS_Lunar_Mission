import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge, inputClass } from "@/components/kit";
import { formatDeg } from "@/lib/astro";
import { analyseSite } from "@/lib/mission";
import { LUNAR_SITES, findSite } from "@/lib/sites";
import { useSpaceWeather } from "@/lib/use-weather";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Sites — LunaSight" },
      { name: "description", content: "Compare lunar south-pole sites side by side for Sun, Earth, relay and terrain conditions." },
      { property: "og:title", content: "Compare Sites — LunaSight" },
      { property: "og:description", content: "Side-by-side lunar south-pole site comparison." },
    ],
  }),
  component: Compare,
});

function Compare() {
  const [ids, setIds] = useState([LUNAR_SITES[0]!.id, LUNAR_SITES[2]!.id, LUNAR_SITES[4]!.id]);
  const [dateStr, setDateStr] = useState("2026-10-05T18:30");
  const weather = useSpaceWeather();
  const date = useMemo(() => {
    const d = new Date(dateStr + ":00Z");
    return isNaN(d.getTime()) ? new Date() : d;
  }, [dateStr]);
  const rows = useMemo(
    () => ids.map((id) => analyseSite({ site: findSite(id), date, spanHours: 168, weather: weather.data?.status ?? "UNKNOWN", steps: 84 })),
    [ids, date, weather.data?.status],
  );

  const metrics: { k: string; v: (a: (typeof rows)[number]) => React.ReactNode }[] = [
    { k: "Sun now", v: (a) => <span className="text-sun">{formatDeg(a.now.sun.elevation)}</span> },
    { k: "Sunlit (7 d)", v: (a) => `${Math.round(a.sunlitFraction * 100)}%` },
    { k: "Earth now", v: (a) => <span className="text-earth">{formatDeg(a.now.earth.elevation)}</span> },
    { k: "Direct Earth (7 d)", v: (a) => `${Math.round(a.earthVisibleFraction * 100)}%` },
    { k: "Communication", v: (a) => <Badge tone={a.endToEnd === "GAP" ? "critical" : "earth"}>{a.endToEnd === "DIRECT" ? "Direct" : a.endToEnd === "AVAILABLE" ? "Via relay" : "Gap"}</Badge> },
    { k: "Relay coverage (7 d)", v: (a) => <span className="text-relay">{Math.round(a.relayFraction * 100)}%</span> },
    { k: "Mean slope", v: (a) => `${a.site.meanSlope.toFixed(1)}°` },
    { k: "Terrain", v: (a) => <Badge tone={a.site.terrainConfidence === "LOW" ? "unknown" : a.scores.terrain >= 70 ? "favorable" : "caution"}>{a.site.terrainConfidence === "LOW" ? "Data gap" : a.scores.terrain >= 70 ? "Favorable" : "Review"}</Badge> },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="label-xs text-earth">Compare sites</p>
          <p className="text-sm text-muted-foreground">Same date for all sites. Change the date to update every column.</p>
        </div>
        <input type="datetime-local" className={`${inputClass} ml-auto w-auto`} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 text-left label-xs">Metric</th>
              {ids.map((id, i) => (
                <th key={i} className="p-3 text-left">
                  <p className="label-xs mb-1">Site {"ABC"[i]}</p>
                  <select className={inputClass} value={id} onChange={(e) => setIds(ids.map((x, j) => (j === i ? e.target.value : x)))}>
                    {LUNAR_SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.k} className="border-b border-border last:border-0">
                <td className="p-4 text-muted-foreground">{m.k}</td>
                {rows.map((a, i) => <td key={i} className="metric p-4">{m.v(a)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">No site is ranked as a definitive winner. Values are planning-level estimates; relay coverage is simulated.</p>
    </div>
  );
}
