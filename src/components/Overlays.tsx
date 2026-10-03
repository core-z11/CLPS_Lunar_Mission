import type { SpaceWeatherPayload } from "@/lib/space-weather.functions";
import { Badge, type Tone } from "./kit";

export const wxTone = (s?: string): Tone =>
  s === "QUIET" ? "favorable" : s === "ELEVATED" ? "caution" : s === "ACTIVE" || s === "SEVERE" ? "critical" : "unknown";

export function SpaceWeatherContent({ data, loading }: { data?: SpaceWeatherPayload | undefined; loading: boolean }) {
  if (loading) return <p className="font-mono text-sm text-muted-foreground">Loading space weather…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Space weather data unavailable.</p>;
  const prov = (p: string) => <Badge tone={p === "LIVE" ? "favorable" : "caution"}>{p === "LIVE" ? "● Live" : "● Demo / cached"}</Badge>;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Badge tone={wxTone(data.status)} className="text-sm">● {data.status}</Badge>
        {prov(data.provenance)}
      </div>
      <dl className="divide-y divide-border rounded-md border border-border">
        {[
          ["Planetary K-index", data.planetaryK.value?.toFixed(1) ?? "—", data.planetaryK.provenance, data.planetaryK.source],
          ["GOES X-ray (latest)", data.xray.class ?? "—", data.xray.provenance, data.xray.source],
          ["Solar wind speed", data.solarWind.speedKmS ? `${Math.round(data.solarWind.speedKmS)} km/s` : "—", data.solarWind.provenance, data.solarWind.source],
          ["Solar wind density", data.solarWind.densityPerCm3 != null ? `${data.solarWind.densityPerCm3.toFixed(1)} p/cm³` : "—", data.solarWind.provenance, data.solarWind.source],
          ["IMF Bz", data.solarWind.bzNt != null ? `${data.solarWind.bzNt.toFixed(1)} nT` : "—", data.solarWind.provenance, data.solarWind.source],
        ].map(([k, v, p, src]) => (
          <div key={k} className="flex items-center justify-between gap-3 p-3">
            <div>
              <dt className="text-sm">{k}</dt>
              <dd className="text-[11px] text-muted-foreground">{src}</dd>
            </div>
            <div className="text-right">
              <p className="metric">{v}</p>
              <p className={`font-mono text-[10px] ${p === "LIVE" ? "text-favorable" : "text-caution"}`}>{p}</p>
            </div>
          </div>
        ))}
      </dl>
      <div>
        <p className="label-xs">Recent activity</p>
        <ul className="mt-2 space-y-2">
          {data.events.map((e) => (
            <li key={e.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span>{e.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{e.type}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {new Date(e.time).toISOString().replace("T", " ").slice(0, 16)} UTC · {e.source}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-md border border-caution/30 bg-caution/5 p-3 text-sm">
        <p className="label-xs text-caution">Mission note</p>
        <p className="mt-1 text-muted-foreground">
          {data.status === "QUIET"
            ? "Low concern. Continue routine monitoring."
            : "Review radiation environment and communication planning against current conditions."}
        </p>
      </div>
      {data.notes.map((n) => (
        <p key={n} className="text-xs text-muted-foreground">{n}</p>
      ))}
      <p className="text-[11px] text-muted-foreground">Updated {new Date(data.updatedAt).toISOString().slice(11, 16)} UTC. No probabilities or doses are inferred.</p>
    </div>
  );
}

const SOURCES: { name: string; purpose: string; status: "IN USE" | "REFERENCE" | "LIVE"; url: string }[] = [
  { name: "NASA LRO / LROC", purpose: "Moon colour mosaic used for the 3D Moon (via NASA SVS CGI Moon Kit).", status: "IN USE", url: "https://svs.gsfc.nasa.gov/4720" },
  { name: "NASA LRO / LOLA", purpose: "Lunar elevation model used for 3D relief; site terrain values are literature estimates.", status: "IN USE", url: "https://pds-geosciences.wustl.edu/missions/lro/lola.htm" },
  { name: "IAU / WGCCRE 2009", purpose: "Lunar pole and prime-meridian rotation model (libration).", status: "IN USE", url: "https://astrogeology.usgs.gov/groups/iau-wgccre" },
  { name: "JPL Horizons", purpose: "Reference for validating the analytic Sun/Moon ephemeris.", status: "REFERENCE", url: "https://ssd.jpl.nasa.gov/horizons/" },
  { name: "NASA SPICE / NAIF", purpose: "Reference frames standard; planned higher-precision upgrade.", status: "REFERENCE", url: "https://naif.jpl.nasa.gov/naif/" },
  { name: "NASA DONKI", purpose: "Space-weather event catalogue (CME, flare, SEP); planned adapter.", status: "REFERENCE", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
  { name: "NOAA SWPC", purpose: "K-index, real-time solar wind and GOES X-ray flux.", status: "LIVE", url: "https://www.swpc.noaa.gov/" },
  { name: "NASA LunaNet / LCRNS", purpose: "Concept inspiration for the simulated relay constellation.", status: "REFERENCE", url: "https://www.nasa.gov/humans-in-space/lunanet-empowering-artemis-with-communications-and-navigation-interoperability/" },
];

export function DataSourcesContent() {
  return (
    <div className="space-y-3">
      {SOURCES.map((s) => (
        <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border p-3 transition-colors hover:bg-accent/50">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{s.name}</span>
            <Badge tone={s.status === "LIVE" ? "favorable" : s.status === "IN USE" ? "earth" : "unknown"}>{s.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.purpose}</p>
        </a>
      ))}
      <p className="pt-2 text-xs text-muted-foreground">
        Relay satellites are a simulation, not deployed spacecraft. LunaSight is not affiliated with or endorsed by NASA.
      </p>
    </div>
  );
}
