import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/kit";
import { SouthPoleMap } from "@/components/SouthPoleMap";
import { formatAz, formatDeg, subEarthPoint, subSolarPoint } from "@/lib/astro";
import { relayStates } from "@/lib/relays";
import { syntheticTerrain, LUNAR_SITES } from "@/lib/sites";
import { skyState } from "@/lib/astro";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore the South Pole — LunaSight" },
      { name: "description", content: "Click anywhere near the lunar south pole to see Sun, Earth and relay visibility." },
      { property: "og:title", content: "Explore the South Pole — LunaSight" },
      { property: "og:description", content: "Interactive lunar south-pole explorer." },
    ],
  }),
  component: Explore,
});

const DATE = new Date(Date.UTC(2026, 9, 5, 18, 30));

function Explore() {
  const [pt, setPt] = useState<{ lat: number; lon: number; name?: string; elevationM: number } | null>(null);
  const subSun = useMemo(() => subSolarPoint(DATE), []);
  const subEarth = useMemo(() => subEarthPoint(DATE), []);
  const info = useMemo(() => {
    if (!pt) return null;
    const s = skyState(DATE, pt.lat, pt.lon, pt.elevationM);
    const relays = relayStates(DATE, pt.lat, pt.lon, pt.elevationM).filter((r) => r.linkAvailable).length;
    return { s, relays };
  }, [pt]);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-6 md:grid-cols-[1fr_320px]">
      <div className="panel starfield p-4">
        <p className="label-xs text-foreground">Explore · {DATE.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
        <SouthPoleMap
          selected={pt ?? { lat: -90, lon: 0 }}
          sunLon={subSun.lon}
          earthLon={subEarth.lon}
          sunElevation={1}
          onSelectSite={(id) => {
            const s = LUNAR_SITES.find((x) => x.id === id)!;
            setPt({ lat: s.lat, lon: s.lon, name: s.name, elevationM: s.elevationM });
          }}
          onPickPoint={(lat, lon) => setPt({ lat, lon, elevationM: syntheticTerrain(lat, lon).elevationM })}
        />
      </div>
      <div className="panel h-fit p-5 animate-fade-in">
        {!pt || !info ? (
          <p className="text-sm text-muted-foreground">Click anywhere on the south pole to inspect a location.</p>
        ) : (
          <div className="space-y-4">
            <p className="label-xs">Location</p>
            <p className="text-sm">{pt.name ?? "Custom point"}</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Latitude</dt><dd className="metric text-right">{pt.lat.toFixed(2)}°</dd>
              <dt className="text-muted-foreground">Longitude</dt><dd className="metric text-right">{pt.lon.toFixed(2)}°</dd>
              <dt className="text-muted-foreground">Elevation</dt><dd className="metric text-right">{pt.elevationM.toLocaleString()} m</dd>
              <dt className="text-sun">Sun</dt><dd className="metric text-right">{formatDeg(info.s.sun.elevation)} · {formatAz(info.s.sun.azimuth)}</dd>
              <dt className="text-earth">Earth</dt><dd className="metric text-right">{formatDeg(info.s.earth.elevation)} · {formatAz(info.s.earth.azimuth)}</dd>
              <dt className="text-relay">Relay</dt><dd className="metric text-right">{info.relays} links</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Badge tone={info.s.sunlit ? "sun" : "critical"}>{info.s.sunlit ? "Sunlit" : "Shadow"}</Badge>
              <Badge tone={info.s.earthVisible ? "earth" : "critical"}>{info.s.earthVisible ? "Earth visible" : "Earth blocked"}</Badge>
              <Badge tone="caution">Relays simulated</Badge>
            </div>
            <Link to="/" className="block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
              Use this site in Mission
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
