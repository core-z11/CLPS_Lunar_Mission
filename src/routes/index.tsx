import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { CameraMode } from "@/components/CameraMode";
import { CommTimeline } from "@/components/CommTimeline";
import { Drawer } from "@/components/Drawer";
import { Badge, Button, Field, inputClass, scoreTone, type Tone } from "@/components/kit";
import { LocalSky } from "@/components/LocalSky";
import { DataSourcesContent, SpaceWeatherContent, wxTone } from "@/components/Overlays";
import { SouthPoleMap } from "@/components/SouthPoleMap";
import { bodyDirections, formatAz, formatDeg, formatDuration, subEarthPoint, subSolarPoint } from "@/lib/astro";
import { analyseSite, planningStatus, type SpaceWeatherLevel } from "@/lib/mission";
import { RELAYS } from "@/lib/relays";
import { LUNAR_SITES, findSite, syntheticTerrain, type LunarSite } from "@/lib/sites";
import { useSpaceWeather } from "@/lib/use-weather";

const Moon3D = lazy(() => import("@/components/Moon3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LunaSight — Find the Window. Plan the Mission." },
      { name: "description", content: "Interactive lunar south-pole mission console: Sun, Earth, relay links, terrain and space weather for any site and time." },
      { property: "og:title", content: "LunaSight — Find the Window. Plan the Mission." },
      { property: "og:description", content: "A playable mission console for planning a lunar south-pole landing." },
    ],
  }),
  component: Mission,
});

const coordSchema = z.object({ lat: z.number().min(-90).max(-75), lon: z.number().min(-180).max(180) });
const SPANS = [
  { label: "24H", hours: 24 },
  { label: "7D", hours: 168 },
  { label: "30D", hours: 720 },
];
const RADII = [0.25, 0.5, 1];
const DEMO_DATE = new Date(Date.UTC(2026, 9, 5, 18, 30));
const iso = (d: Date) => d.toISOString().slice(0, 16);

function Mission() {
  const [siteId, setSiteId] = useState(LUNAR_SITES[0].id);
  const [custom, setCustom] = useState<{ lat: number; lon: number } | null>(null);
  const [baseDate, setBaseDate] = useState(DEMO_DATE);
  const [offsetH, setOffsetH] = useState(0);
  const [spanIdx, setSpanIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<"3D" | "2D">("3D");
  const [radiusKm, setRadiusKm] = useState(0.5);
  const [draft, setDraft] = useState({ lat: String(LUNAR_SITES[0].lat), lon: String(LUNAR_SITES[0].lon), date: iso(DEMO_DATE) });
  const [err, setErr] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | "check" | "terrain" | "weather" | "data">(null);
  const [camera, setCamera] = useState(false);
  const [observer, setObserver] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const enabled = useMemo(() => new Set(RELAYS.map((r) => r.id)), []);

  const weather = useSpaceWeather();
  const wx: SpaceWeatherLevel = weather.data?.status ?? "UNKNOWN";
  const span = SPANS[spanIdx].hours;
  const date = useMemo(() => new Date(baseDate.getTime() + offsetH * 3600e3), [baseDate, offsetH]);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setOffsetH((h) => (h + dt * (span / 40) > span / 2 ? -span / 2 : h + dt * (span / 40)));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, span]);

  const site: LunarSite = useMemo(
    () =>
      custom
        ? { id: "custom", name: `Custom ${custom.lat.toFixed(2)}°, ${custom.lon.toFixed(2)}°`, ...syntheticTerrain(custom.lat, custom.lon) }
        : findSite(siteId),
    [custom, siteId],
  );

  const windowA = useMemo(
    () => analyseSite({ site, date: baseDate, spanHours: span, weather: wx, enabledRelays: enabled, steps: 160 }),
    [site, baseDate, span, wx, enabled],
  );
  const live = useMemo(() => analyseSite({ site, date, spanHours: 24, weather: wx, enabledRelays: enabled, steps: 24 }), [site, date, wx, enabled]);
  const dirs = useMemo(() => bodyDirections(date), [date]);
  const subSun = useMemo(() => subSolarPoint(date), [date]);
  const subEarth = useMemo(() => subEarthPoint(date), [date]);

  const { now, scores } = live;
  const linked = live.relays.filter((r) => r.linkAvailable);
  const status = planningStatus(scores.overall);

  const pick = useCallback((lat: number, lon: number) => {
    if (lat > -75) return;
    const p = { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
    setCustom(p);
    setDraft((d) => ({ ...d, lat: String(p.lat), lon: String(p.lon) }));
  }, []);

  const analyze = () => {
    const c = coordSchema.safeParse({ lat: Number(draft.lat), lon: Number(draft.lon) });
    const d = new Date(draft.date + ":00Z");
    if (!c.success || draft.lat === "" || isNaN(d.getTime())) {
      setErr("Latitude −90 to −75, longitude −180 to 180, valid UTC date.");
      return;
    }
    setErr(null);
    const match = LUNAR_SITES.find((s) => Math.abs(s.lat - c.data.lat) < 0.01 && Math.abs(s.lon - c.data.lon) < 0.01);
    if (match) {
      setCustom(null);
      setSiteId(match.id);
    } else setCustom(c.data);
    setBaseDate(d);
    setOffsetH(0);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeoMsg("Geolocation unavailable.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoMsg(null);
        setObserver({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
      },
      () => setGeoMsg("Permission not granted."),
      { timeout: 10000 },
    );
  };

  const sunTone: Tone = now.sun.elevation > 3 ? "favorable" : now.sun.elevation > 0 ? "caution" : "critical";
  const terrainState = site.terrainConfidence === "LOW" ? "DATA GAP" : scores.terrain >= 70 ? "PASS" : "REVIEW";
  const relayState = linked.length > 1 ? "AVAILABLE" : linked.length === 1 ? "LIMITED" : "NONE";
  const checks: { k: string; v: string; tone: Tone; d: string }[] = [
    { k: "Terrain", v: terrainState, tone: terrainState === "DATA GAP" ? "unknown" : scoreTone(scores.terrain), d: `${site.meanSlope.toFixed(1)}° mean slope` },
    { k: "Sun", v: now.sun.elevation > 3 ? "VISIBLE" : now.sun.elevation > 0 ? "LOW" : "SHADOW", tone: sunTone, d: formatDeg(now.sun.elevation) },
    { k: "Earth", v: now.earthVisible ? "VISIBLE" : "BLOCKED", tone: now.earthVisible ? "earth" : "critical", d: formatDeg(now.earth.elevation) },
    { k: "Relay", v: relayState, tone: linked.length > 1 ? "relay" : linked.length ? "caution" : "critical", d: `${linked.length} simulated links` },
    { k: "Space weather", v: wx, tone: wxTone(wx), d: weather.data?.provenance === "LIVE" ? "Live" : "Demo / cached" },
  ];

  const log: { ok: boolean | null; t: string }[] = [
    { ok: true, t: "Landing site selected" },
    { ok: site.terrainConfidence !== "LOW", t: site.terrainConfidence === "LOW" ? "Terrain modelled — data gap" : "Terrain loaded" },
    { ok: true, t: "Sun geometry calculated" },
    { ok: now.sunlit, t: now.sunlit ? "Power window open" : "Site in shadow" },
    { ok: now.earthVisible, t: now.earthVisible ? "Direct Earth link available" : "Direct Earth link blocked" },
    { ok: linked.length > 0, t: linked.length ? `Relay available (${linked.map((r) => r.relay.name.slice(-1)).join(", ")})` : "No relay link" },
    { ok: weather.isLoading ? null : wx === "QUIET", t: weather.isLoading ? "Space weather loading…" : `Space weather ${wx.toLowerCase()}` },
  ];

  const route = live.endToEnd;

  return (
    <div className="mx-auto max-w-[1600px] px-3 pb-8 pt-4 md:px-5">
      {/* Mission header strip */}
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="label-xs text-primary">Mission 01 · South pole landing</p>
          <p className="text-sm text-muted-foreground">Objective: find an illumination + communication window.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge tone="caution">● Demo simulation</Badge>
          <Button variant="primary" onClick={() => setDrawer("check")}>Pre-landing check</Button>
          <Button variant="outline" onClick={() => setDrawer("terrain")}>Terrain</Button>
          <Button variant="outline" onClick={() => setDrawer("weather")}>Space weather</Button>
          <Button variant="outline" onClick={() => setCamera(true)}>Camera</Button>
          <Button variant="ghost" onClick={() => setDrawer("data")}>Data sources</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[260px_1fr_290px]">
        {/* LEFT — mission target */}
        <aside className="panel order-2 space-y-4 p-4 lg:order-1">
          <p className="label-xs text-foreground">Mission target</p>
          <Field label="Landing site">
            <select
              className={inputClass}
              value={custom ? "custom" : siteId}
              onChange={(e) => {
                const s = findSite(e.target.value);
                setCustom(null);
                setSiteId(s.id);
                setDraft((d) => ({ ...d, lat: String(s.lat), lon: String(s.lon) }));
              }}
            >
              {LUNAR_SITES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              {custom && <option value="custom">{site.name}</option>}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude">
              <input className={inputClass} value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} />
            </Field>
            <Field label="Longitude">
              <input className={inputClass} value={draft.lon} onChange={(e) => setDraft({ ...draft, lon: e.target.value })} />
            </Field>
          </div>
          <Field label="Landing date / time (UTC)">
            <input type="datetime-local" className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          {err && <p className="text-xs text-critical">{err}</p>}
          <Button className="w-full tracking-[0.15em]" onClick={analyze}>ANALYZE</Button>

          <div className="border-t border-border pt-4">
            <p className="label-xs">Landing zone</p>
            <div className="mt-2 flex gap-1">
              {RADII.map((r) => (
                <button key={r} onClick={() => setRadiusKm(r)} className={`flex-1 rounded py-1.5 font-mono text-xs ${r === radiusKm ? "bg-accent text-foreground" : "text-muted-foreground"}`}>
                  {r < 1 ? `${r * 1000} m` : "1 km"}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="label-xs">Observer location (Earth)</p>
            {observer ? (
              <div className="mt-2 text-sm">
                <p className="metric">{observer.lat.toFixed(3)}°, {observer.lon.toFixed(3)}°</p>
                <p className="text-xs text-muted-foreground">±{Math.round(observer.acc)} m · this session only</p>
                <button className="mt-1 text-xs text-primary hover:underline" onClick={() => setObserver(null)}>Clear location</button>
              </div>
            ) : (
              <Button variant="outline" className="mt-2 w-full" onClick={locate}>Use my location</Button>
            )}
            {geoMsg && <p className="mt-1 text-xs text-caution">{geoMsg}</p>}
            <p className="mt-3 label-xs">Current lunar position</p>
            <p className="metric mt-1 text-sm">{site.lat.toFixed(2)}°, {site.lon.toFixed(2)}°</p>
          </div>
        </aside>

        {/* CENTER — Moon */}
        <section className="panel relative order-1 overflow-hidden lg:order-2">
          <div className="absolute left-3 top-3 z-10 flex rounded-md border border-border bg-background/70 p-0.5 backdrop-blur">
            {(["2D", "3D"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 font-mono text-xs ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{v}</button>
            ))}
          </div>
          <div className="absolute right-3 top-3 z-10 text-right">
            <p className="label-xs">Mission time</p>
            <p className="metric text-lg">{date.toISOString().replace("T", " ").slice(0, 16)}</p>
            <p className="font-mono text-[10px] text-muted-foreground">UTC · T{offsetH >= 0 ? "+" : "−"}{formatDuration(Math.abs(offsetH))}</p>
          </div>
          <div className="starfield aspect-square w-full md:aspect-[16/11]">
            {view === "3D" ? (
              <ClientOnly fallback={<Loading />}>
                <Suspense fallback={<Loading />}>
                  <Moon3D
                    site={site}
                    sunDir={dirs.sun}
                    earthDir={dirs.earth}
                    relays={live.relays.map((r) => ({ id: r.relay.id, name: r.relay.name, position: r.position, link: r.linkAvailable }))}
                    onPick={pick}
                  />
                </Suspense>
              </ClientOnly>
            ) : (
              <div className="mx-auto h-full max-w-[640px] p-6">
                <SouthPoleMap
                  selected={{ lat: site.lat, lon: site.lon, id: custom ? undefined : site.id }}
                  sunLon={subSun.lon}
                  earthLon={subEarth.lon}
                  sunElevation={now.sun.elevation}
                  relays={live.relays}
                  radiusKm={radiusKm}
                  onSelectSite={(id) => {
                    const s = findSite(id);
                    setCustom(null);
                    setSiteId(id);
                    setDraft((d) => ({ ...d, lat: String(s.lat), lon: String(s.lon) }));
                  }}
                  onPickPoint={pick}
                />
              </div>
            )}
          </div>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="text-sun">● SUN</span>
            <span className="text-earth">● EARTH</span>
            <span className="text-relay">◆ SIMULATED RELAY</span>
            <span className="text-primary">○ LANDING SITE</span>
            <span>Click the Moon to set a site</span>
          </div>
        </section>

        {/* RIGHT — mission status */}
        <aside className="panel order-3 flex flex-col gap-4 p-4">
          <p className="label-xs text-foreground">Mission status</p>
          <StatusRow label="Sun" tone="sun" value={formatDeg(now.sun.elevation)} state={now.sunlit ? "VISIBLE" : "SHADOW"} stateTone={sunTone} sub={`Az ${formatAz(now.sun.azimuth)} · Power window ${now.sun.elevation > 0.5 ? "AVAILABLE" : "CLOSED"}`} />
          <StatusRow
            label="Earth"
            tone="earth"
            value={formatDeg(now.earth.elevation)}
            state={now.earthVisible ? "VISIBLE" : "BLOCKED"}
            stateTone={now.earthVisible ? "earth" : "critical"}
            sub={`Direct link ${now.earthVisible ? "AVAILABLE" : "BLOCKED"} · ${isFinite(live.currentDteWindow.hours) ? formatDuration(live.currentDteWindow.hours) : ">30d"} ${now.earthVisible ? "left" : "to next"}`}
          />
          <StatusRow label="Relay" tone="relay" value={`${linked.length}`} state={relayState} stateTone={linked.length ? "relay" : "critical"} sub={`${linked.length} relays available · simulated`} />
          <StatusRow label="Space weather" tone="caution" value="" state={wx} stateTone={wxTone(wx)} sub={weather.data?.provenance === "LIVE" ? "● Live · NOAA SWPC" : "● Demo / cached"} />
          <StatusRow label="Terrain" tone="unknown" value="" state={terrainState} stateTone={checks[0]!.tone} sub={`${site.meanSlope.toFixed(1)}° slope · ${site.terrainConfidence} confidence`} />

          <div className="rounded-md border border-border bg-background/50 p-3">
            <p className="label-xs">Communication link</p>
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px]">
              <span className="text-earth">EARTH</span>
              <span className={`relative h-px flex-1 overflow-hidden ${route === "GAP" ? "border-t border-dashed border-critical" : "bg-earth/40"}`}>
                {route !== "GAP" && <span className="absolute inset-y-0 w-1/3 animate-[beam_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-relay to-transparent" />}
              </span>
              {route === "AVAILABLE" && (
                <>
                  <span className="text-relay">{live.bestRelay?.relay.name.toUpperCase()}</span>
                  <span className="relative h-px flex-1 overflow-hidden bg-relay/40">
                    <span className="absolute inset-y-0 w-1/3 animate-[beam_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-relay to-transparent" />
                  </span>
                </>
              )}
              <span className="text-primary">PROBE</span>
            </div>
            <p className={`mt-2 font-mono text-xs ${route === "GAP" ? "text-critical" : "text-relay"}`}>
              {route === "DIRECT" ? "DIRECT-TO-EARTH" : route === "AVAILABLE" ? "VIA SIMULATED RELAY" : "NETWORK GAP"}
            </p>
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="label-xs">Mission readiness</p>
            <p className={`mt-1 text-lg font-medium ${scores.overall >= 70 ? "text-favorable" : "text-caution"}`}>{scores.overall >= 70 ? "READY FOR FURTHER REVIEW" : "REQUIRES REVIEW"}</p>
            <p className="metric mt-1 text-xs text-muted-foreground">Planning indicator {scores.overall}/100 · not a landing clearance</p>
          </div>

          <div>
            <p className="label-xs">Mission log</p>
            <ul className="mt-2 space-y-1 font-mono text-[11px]">
              {log.map((l) => (
                <li key={l.t} className={l.ok === null ? "text-muted-foreground" : l.ok ? "text-favorable" : "text-caution"}>
                  {l.ok === null ? "…" : l.ok ? "✓" : "!"} <span className="text-foreground/85">{l.t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {/* BOTTOM — local sky + timeline */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[320px_1fr]">
        <section className="panel p-4">
          <p className="label-xs text-foreground">Local sky</p>
          <LocalSky sun={now.sun} earth={now.earth} relays={live.relays} />
          <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px]">
            <span className="text-sun">SUN {formatAz(now.sun.azimuth)} {formatDeg(now.sun.elevation)}</span>
            <span className="text-earth">EARTH {formatAz(now.earth.azimuth)} {formatDeg(now.earth.elevation)}</span>
            <span className="text-relay">{linked.length}/{live.relays.length} RELAYS</span>
          </div>
        </section>
        <section className="panel p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="label-xs text-foreground">Communication window</p>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" className="w-20 py-1" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ Pause" : "▶ Play"}</Button>
              <div className="flex rounded-md border border-input p-0.5">
                {SPANS.map((s, i) => (
                  <button key={s.label} onClick={() => { setSpanIdx(i); setOffsetH(0); }} className={`rounded px-2.5 py-1 font-mono text-xs ${i === spanIdx ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>
          <CommTimeline samples={windowA.samples} cursor={date} enabled={enabled} onPick={(d) => setOffsetH((d.getTime() - baseDate.getTime()) / 3600e3)} />
          <p className="mt-3 text-xs text-muted-foreground">
            Drag across the timeline — the Moon, Local Sky and mission status follow. Geometric horizon only; terrain may add local shadowing.
          </p>
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        LunaSight is an educational and research prototype and is not a flight-certified landing or navigation system.
      </p>

      <Drawer open={drawer === "check"} onClose={() => setDrawer(null)} title="Pre-landing check" wide>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {checks.map((c) => (
            <div key={c.k} className="rounded-md border border-border bg-background/50 p-4 text-center">
              <p className="label-xs">{c.k}</p>
              <Badge tone={c.tone} className="mt-3 text-sm">{c.v}</Badge>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md border border-border p-5 text-center">
          <p className="label-xs">Planning status</p>
          <p className={`mt-2 text-2xl font-medium ${scores.overall >= 70 ? "text-favorable" : "text-caution"}`}>{status}</p>
          <p className="mt-2 text-xs text-muted-foreground">Requires mission-specific verification. Not a landing clearance.</p>
        </div>
      </Drawer>

      <Drawer open={drawer === "terrain"} onClose={() => setDrawer(null)} title="Landing zone">
        <p className="text-sm">{site.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{site.notes}</p>
        <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Zone radius</dt><dd className="metric text-right">{radiusKm * 1000} m</dd>
          <dt className="text-muted-foreground">Elevation</dt><dd className="metric text-right">{site.elevationM.toLocaleString()} m</dd>
          <dt className="text-muted-foreground">Mean slope</dt><dd className="metric text-right">{site.meanSlope.toFixed(1)}°</dd>
          <dt className="text-muted-foreground">Max slope</dt><dd className="metric text-right">{site.maxSlope.toFixed(1)}°</dd>
          <dt className="text-muted-foreground">Roughness</dt><dd className="metric text-right">{site.roughness.toFixed(2)}</dd>
          <dt className="text-muted-foreground">Local relief</dt><dd className="metric text-right">{site.reliefM} m</dd>
          <dt className="text-muted-foreground">Terrain</dt><dd className="text-right"><Badge tone={checks[0]!.tone}>{terrainState === "PASS" ? "✓ Favorable" : terrainState === "REVIEW" ? "! Review" : "? No data"}</Badge></dd>
          <dt className="text-muted-foreground">Data</dt><dd className="text-right text-xs">{custom ? "Modelled (no measured data)" : "Estimate · NASA LOLA literature"}</dd>
        </dl>
      </Drawer>

      <Drawer open={drawer === "weather"} onClose={() => setDrawer(null)} title="Space weather">
        <SpaceWeatherContent data={weather.data} loading={weather.isLoading} />
      </Drawer>

      <Drawer open={drawer === "data"} onClose={() => setDrawer(null)} title="Data sources">
        <DataSourcesContent />
      </Drawer>

      {camera && <CameraMode onClose={() => setCamera(false)} siteName={site.name} sun={now.sun} earth={now.earth} status={scores.overall >= 70 ? "Further review" : "Requires review"} />}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
      <div className="space-y-1">
        <p>✓ Ephemeris computed</p>
        <p className="animate-pulse">Loading lunar terrain (LRO/LOLA)…</p>
      </div>
    </div>
  );
}

function StatusRow({ label, tone, value, state, stateTone, sub }: { label: string; tone: Tone; value: string; state: string; stateTone: Tone; sub: string }) {
  const color: Record<Tone, string> = { sun: "text-sun", earth: "text-earth", relay: "text-relay", caution: "text-caution", unknown: "text-foreground", favorable: "text-favorable", critical: "text-critical" };
  return (
    <div className="border-b border-border pb-3 last:border-0">
      <div className="flex items-center justify-between">
        <p className={`label-xs ${color[tone]}`}>{label}</p>
        <Badge tone={stateTone}>{state}</Badge>
      </div>
      {value && <p className={`metric mt-1 text-2xl ${color[tone]}`}>{value}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
