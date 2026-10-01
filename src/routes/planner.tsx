import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Badge, Button, Disclaimer, Field, Metric, Panel, ScoreBar, inputClass, scoreTone, type Tone } from "@/components/kit";
import { HorizonStrip, LocalSky } from "@/components/LocalSky";
import { SkyTimeline } from "@/components/SkyTimeline";
import { SouthPoleMap } from "@/components/SouthPoleMap";
import { formatAz, formatDeg, formatDuration, subEarthPoint, subSolarPoint } from "@/lib/astro";
import { DEFAULT_WEIGHTS, analyseSite, planningStatus, type SpaceWeatherLevel, type Weights } from "@/lib/mission";
import { RELAYS } from "@/lib/relays";
import { LUNAR_SITES, findSite, syntheticTerrain, type LunarSite } from "@/lib/sites";
import { useSpaceWeather } from "@/lib/use-weather";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Mission Planner — LunaSight" },
      {
        name: "description",
        content: "Sun and Earth positions, direct-to-Earth windows, relay links and a planning indicator for a lunar south-pole site.",
      },
      { property: "og:title", content: "Mission Planner — LunaSight" },
      { property: "og:description", content: "Interactive lunar south-pole mission planning dashboard." },
    ],
  }),
  component: Planner,
});

const coordSchema = z.object({
  lat: z.number().min(-90).max(-75),
  lon: z.number().min(-180).max(180),
});

const SPANS = [
  { label: "24 h", hours: 24 },
  { label: "7 d", hours: 24 * 7 },
  { label: "30 d", hours: 24 * 30 },
];
const SPEEDS = [1, 10, 100, 1000];
const RADII = [0.25, 0.5, 1, 2];

const toInputValue = (d: Date) => d.toISOString().slice(0, 16);

function Planner() {
  const [siteId, setSiteId] = useState<string>(LUNAR_SITES[0].id);
  const [custom, setCustom] = useState<{ lat: number; lon: number } | null>(null);
  const [baseDate, setBaseDate] = useState(() => new Date(Date.UTC(2026, 9, 5, 18, 30)));
  const [offsetH, setOffsetH] = useState(0);
  const [spanIdx, setSpanIdx] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(100);
  const [radiusKm, setRadiusKm] = useState(0.5);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(RELAYS.map((r) => r.id)));
  const [latIn, setLatIn] = useState("");
  const [lonIn, setLonIn] = useState("");
  const [coordErr, setCoordErr] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preLanding, setPreLanding] = useState(false);
  const [observer, setObserver] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  const weather = useSpaceWeather();
  const weatherLevel: SpaceWeatherLevel = weather.data?.status ?? "UNKNOWN";

  const span = SPANS[spanIdx].hours;
  const date = useMemo(() => new Date(baseDate.getTime() + offsetH * 3600e3), [baseDate, offsetH]);

  // Mission-time playback (simulation clock).
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setOffsetH((h) => {
        const next = h + (dt * speed) / 3600 * 60; // speed × 1 min per second
        return next > span / 2 ? -span / 2 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, speed, span]);

  const site: LunarSite = useMemo(() => {
    if (custom) {
      return { id: "custom", name: `Custom point ${custom.lat.toFixed(2)}°, ${custom.lon.toFixed(2)}°`, ...syntheticTerrain(custom.lat, custom.lon) };
    }
    return findSite(siteId);
  }, [custom, siteId]);

  // Window analysis is anchored to the base date so scrubbing stays smooth.
  const windowAnalysis = useMemo(
    () => analyseSite({ site, date: baseDate, spanHours: span, weather: weatherLevel, weights, enabledRelays: enabled, steps: span > 200 ? 240 : 144 }),
    [site, baseDate, span, weatherLevel, weights, enabled],
  );
  const live = useMemo(
    () => analyseSite({ site, date, spanHours: 24, weather: weatherLevel, weights, enabledRelays: enabled, steps: 24 }),
    [site, date, weatherLevel, weights, enabled],
  );
  const subSun = useMemo(() => subSolarPoint(date), [date]);
  const subEarth = useMemo(() => subEarthPoint(date), [date]);

  const { now, scores } = live;
  const linked = live.relays.filter((r) => r.linkAvailable);

  const applyCoords = () => {
    const parsed = coordSchema.safeParse({ lat: Number(latIn), lon: Number(lonIn) });
    if (!parsed.success || latIn === "" || lonIn === "") {
      setCoordErr("Enter latitude between −90 and −75 and longitude between −180 and 180.");
      return;
    }
    setCoordErr(null);
    setCustom(parsed.data);
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoErr("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeoErr(null);
        setObserver({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
      },
      () => setGeoErr("Location permission was not granted."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const sunTone: Tone = now.sun.elevation > 3 ? "favorable" : now.sun.elevation > 0 ? "caution" : "critical";
  const earthTone: Tone = now.earth.elevation > 0 ? "earth" : "critical";
  const relayTone: Tone = linked.length > 1 ? "relay" : linked.length === 1 ? "caution" : "critical";
  const wxTone: Tone =
    weatherLevel === "QUIET" ? "favorable" : weatherLevel === "ELEVATED" ? "caution" : weatherLevel === "UNKNOWN" ? "unknown" : "critical";

  const statusCards = [
    {
      k: "Terrain",
      v: site.terrainConfidence === "LOW" ? "DATA GAP" : scores.terrain >= 70 ? "PASS" : "REVIEW",
      tone: (site.terrainConfidence === "LOW" ? "unknown" : scoreTone(scores.terrain)) as Tone,
      d: `${site.meanSlope.toFixed(1)}° mean slope`,
    },
    {
      k: "Sun",
      v: now.sun.elevation > 3 ? "VISIBLE" : now.sun.elevation > 0 ? "LOW" : "SHADOW",
      tone: sunTone,
      d: `${formatDeg(now.sun.elevation)} · ${formatAz(now.sun.azimuth)}`,
    },
    {
      k: "Earth",
      v: now.earthVisible ? "VISIBLE" : "BLOCKED",
      tone: earthTone,
      d: `${formatDeg(now.earth.elevation)} · ${formatAz(now.earth.azimuth)}`,
    },
    {
      k: "Relay",
      v: linked.length > 1 ? "AVAILABLE" : linked.length === 1 ? "LIMITED" : "NONE",
      tone: relayTone,
      d: `${linked.length} of ${live.relays.length} linked · SIMULATED`,
    },
    {
      k: "Space Weather",
      v: weatherLevel,
      tone: wxTone,
      d: weather.data ? weather.data.provenance : "Loading…",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      {/* Top control bar */}
      <div className="panel flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[240px] flex-1">
          <Field label="Landing site">
            <select
              className={inputClass}
              value={custom ? "custom" : siteId}
              onChange={(e) => {
                if (e.target.value === "custom") return;
                setCustom(null);
                setSiteId(e.target.value);
              }}
            >
              {LUNAR_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {custom && <option value="custom">{site.name}</option>}
            </select>
          </Field>
        </div>
        <Field label="Date / time (UTC)">
          <input
            type="datetime-local"
            className={inputClass}
            value={toInputValue(baseDate)}
            onChange={(e) => {
              const d = new Date(e.target.value + ":00Z");
              if (!isNaN(d.getTime())) {
                setBaseDate(d);
                setOffsetH(0);
              }
            }}
          />
        </Field>
        <Field label="Window">
          <div className="flex rounded-md border border-input p-0.5">
            {SPANS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => {
                  setSpanIdx(i);
                  setOffsetH(0);
                }}
                className={`rounded px-3 py-1.5 font-mono text-xs ${i === spanIdx ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        <Button variant={preLanding ? "primary" : "outline"} onClick={() => setPreLanding((v) => !v)}>
          Pre-landing check
        </Button>
        <Button variant="outline" onClick={useMyLocation}>
          Use my location
        </Button>
      </div>

      {/* Time scrubber */}
      <div className="panel mt-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => setPlaying((p) => !p)} className="w-20">
            {playing ? "Pause" : "Play"}
          </Button>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 font-mono text-xs ${s === speed ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              >
                {s}×
              </button>
            ))}
          </div>
          <input
            type="range"
            min={-span / 2}
            max={span / 2}
            step={span / 1000}
            value={offsetH}
            onChange={(e) => setOffsetH(Number(e.target.value))}
            className="min-w-[200px] flex-1 accent-primary"
            aria-label="Mission time"
          />
          <div className="text-right">
            <p className="label-xs">Simulation time</p>
            <p className="metric text-lg">{date.toISOString().replace("T", " ").slice(0, 16)} UTC</p>
          </div>
        </div>
        <div className="mt-3">
          <SkyTimeline
            samples={windowAnalysis.samples}
            cursor={date}
            onPick={(d) => setOffsetH((d.getTime() - baseDate.getTime()) / 3600e3)}
          />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span className="mr-1.5 inline-block h-0.5 w-4 bg-sun align-middle" />Sun elevation</span>
            <span><span className="mr-1.5 inline-block h-0.5 w-4 bg-earth align-middle" />Earth elevation</span>
            <span><span className="mr-1.5 inline-block h-2 w-4 bg-relay/70 align-middle" />Relay link available (simulated)</span>
            <span><span className="mr-1.5 inline-block h-2 w-4 bg-critical/40 align-middle" />Network gap</span>
            <span className="ml-auto">Click the chart to jump in time</span>
          </div>
        </div>
      </div>

      {preLanding && (
        <div className="mt-4 panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="label-xs">Pre-landing check · {site.name}</h2>
            <Badge tone={scores.overall >= 70 ? "favorable" : "caution"}>{planningStatus(scores.overall)}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statusCards.map((c) => (
              <div key={c.k} className="rounded-md border border-border bg-background/50 p-4">
                <p className="label-xs">{c.k}</p>
                <div className="mt-3">
                  <Badge tone={c.tone} className="text-sm">{c.v}</Badge>
                </div>
                <p className="mt-3 font-mono text-xs text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Planning status only — this is not a landing clearance. Requires mission-specific verification.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_1fr_360px]">
        {/* Left: controls */}
        <div className="space-y-4">
          <Panel title="Coordinates" subtitle="Or click anywhere on the map.">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Lat °">
                <input className={inputClass} placeholder="-89.4" value={latIn} onChange={(e) => setLatIn(e.target.value)} />
              </Field>
              <Field label="Lon °E">
                <input className={inputClass} placeholder="137.0" value={lonIn} onChange={(e) => setLonIn(e.target.value)} />
              </Field>
            </div>
            {coordErr && <p className="mt-2 text-xs text-critical">{coordErr}</p>}
            <Button variant="outline" className="mt-3 w-full" onClick={applyCoords}>
              Analyse point
            </Button>
          </Panel>

          <Panel title="Landing zone">
            <div className="flex gap-1">
              {RADII.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadiusKm(r)}
                  className={`flex-1 rounded px-2 py-1.5 font-mono text-xs ${r === radiusKm ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                >
                  {r < 1 ? `${r * 1000} m` : `${r} km`}
                </button>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Elevation</dt>
              <dd className="metric text-right">{site.elevationM.toLocaleString()} m</dd>
              <dt className="text-muted-foreground">Mean slope</dt>
              <dd className="metric text-right">{site.meanSlope.toFixed(1)}°</dd>
              <dt className="text-muted-foreground">Max slope</dt>
              <dd className="metric text-right">{site.maxSlope.toFixed(1)}°</dd>
              <dt className="text-muted-foreground">Local relief</dt>
              <dd className="metric text-right">{site.reliefM} m</dd>
              <dt className="text-muted-foreground">Roughness</dt>
              <dd className="metric text-right">{site.roughness.toFixed(2)}</dd>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{site.notes}</p>
          </Panel>

          <Panel title="Relay constellation" action={<Badge tone="caution">Simulated</Badge>}>
            <div className="space-y-1.5">
              {live.relays.length === 0 && <p className="text-xs text-muted-foreground">All relays disabled.</p>}
              {RELAYS.map((r) => {
                const st = live.relays.find((x) => x.relay.id === r.id);
                const on = enabled.has(r.id);
                return (
                  <label key={r.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setEnabled((prev) => {
                          const n = new Set(prev);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        })
                      }
                      className="accent-primary"
                    />
                    <span className="flex-1">{r.name}</span>
                    {on && st && (
                      <span className={`font-mono text-xs ${st.linkAvailable ? "text-relay" : "text-muted-foreground"}`}>
                        {st.linkAvailable ? "LINK" : st.siteVisible ? "NO EARTH" : "BELOW MASK"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </Panel>

          <Panel title="Observer location">
            {observer ? (
              <div className="space-y-1 text-sm">
                <p className="metric">
                  {observer.lat.toFixed(2)}°, {observer.lon.toFixed(2)}°
                </p>
                <p className="text-xs text-muted-foreground">±{Math.round(observer.acc)} m accuracy</p>
                <p className="text-xs text-muted-foreground">
                  Used only as an Earth observer reference for this session. Not stored, not a ground station.
                </p>
                <Button variant="ghost" className="mt-1 px-0" onClick={() => setObserver(null)}>
                  Clear location
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {geoErr ?? "Optional. Your location is used only for this session and never uploaded."}
              </p>
            )}
          </Panel>
        </div>

        {/* Center: map + sky */}
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="South pole map" subtitle="Polar view to 80°S · 0° (near side) at bottom">
              <SouthPoleMap
                selected={{ lat: site.lat, lon: site.lon, id: custom ? undefined : site.id }}
                sunLon={subSun.lon}
                earthLon={subEarth.lon}
                sunElevation={now.sun.elevation}
                relays={live.relays}
                radiusKm={radiusKm}
                onSelectSite={(id) => {
                  setCustom(null);
                  setSiteId(id);
                }}
                onPickPoint={(lat, lon) => {
                  setCustom({ lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
                }}
              />
            </Panel>
            <Panel title="Local sky" subtitle="Zenith at centre · horizon on the ring · log elevation scale">
              <LocalSky sun={now.sun} earth={now.earth} relays={live.relays} />
            </Panel>
          </div>
          <Panel title="Horizon panorama" subtitle="Azimuth 0–360° · elevation −10° to +20°">
            <HorizonStrip sun={now.sun} earth={now.earth} relays={live.relays} />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Sun" action={<Badge tone={sunTone}>{now.sunlit ? "Illuminated" : "Shadowed"}</Badge>}>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Elevation" value={formatDeg(now.sun.elevation)} tone="sun" />
                <Metric label="Azimuth" value={formatAz(now.sun.azimuth)} />
                <Metric label="Sunlit in window" value={`${Math.round(windowAnalysis.sunlitFraction * 100)}%`} />
                <Metric label="Power window" value={now.sun.elevation > 0.5 ? "YES" : "NO"} tone={now.sun.elevation > 0.5 ? "favorable" : "critical"} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Geometric horizon only. Local terrain may shadow the site even when the Sun is above 0°.
              </p>
            </Panel>
            <Panel title="Direct to Earth" action={<Badge tone={earthTone}>{live.currentDteWindow.state}</Badge>}>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Elevation" value={formatDeg(now.earth.elevation)} tone="earth" />
                <Metric label="Azimuth" value={formatAz(now.earth.azimuth)} />
                <Metric
                  label={live.currentDteWindow.state === "AVAILABLE" ? "Window remaining" : "Until next window"}
                  value={isFinite(live.currentDteWindow.hours) ? formatDuration(live.currentDteWindow.hours) : "> 30 d"}
                />
                <Metric label="Visible in window" value={`${Math.round(windowAnalysis.earthVisibleFraction * 100)}%`} />
              </div>
              {!now.earthVisible && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Earth is geometrically obstructed by the Moon at this location/time.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Communication path" action={<Badge tone={live.endToEnd === "GAP" ? "critical" : "earth"}>{live.endToEnd === "GAP" ? "Network gap" : live.endToEnd === "DIRECT" ? "Direct link" : "Via relay"}</Badge>}>
            <div className="flex items-center gap-2 font-mono text-xs md:text-sm">
              <span className="rounded border border-earth/40 px-2 py-1 text-earth">EARTH</span>
              {live.endToEnd === "DIRECT" ? (
                <span className="h-px flex-1 bg-earth" />
              ) : live.endToEnd === "AVAILABLE" ? (
                <>
                  <span className="h-px flex-1 bg-relay" />
                  <span className="rounded border border-relay/40 px-2 py-1 text-relay">{live.bestRelay?.relay.name.toUpperCase()}</span>
                  <span className="h-px flex-1 bg-relay" />
                </>
              ) : (
                <span className="h-px flex-1 border-t border-dashed border-critical" />
              )}
              <span className="rounded border border-primary/40 px-2 py-1 text-primary">LANDER</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="label-xs">Probe → Relay</p>
                <p className={`metric mt-1 ${live.relays.some((r) => r.siteVisible) ? "text-relay" : "text-critical"}`}>
                  {live.relays.some((r) => r.siteVisible) ? "CONNECTED" : "BLOCKED"}
                </p>
              </div>
              <div>
                <p className="label-xs">Relay → Earth</p>
                <p className={`metric mt-1 ${linked.length ? "text-relay" : "text-critical"}`}>{linked.length ? "CONNECTED" : "BLOCKED"}</p>
              </div>
              <div>
                <p className="label-xs">Relay coverage</p>
                <p className="metric mt-1">{Math.round(windowAnalysis.relayFraction * 100)}%</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right: assessment */}
        <div className="space-y-4">
          <Panel title="Mission planning indicator" subtitle="Data-based suitability indicator · prototype analysis">
            <div className="flex items-end gap-3">
              <span className="metric text-6xl font-light">{scores.overall}</span>
              <span className="mb-2 text-muted-foreground">/ 100</span>
            </div>
            <Badge tone={scores.overall >= 70 ? "favorable" : "caution"} className="mt-3">
              {planningStatus(scores.overall)}
            </Badge>
            <div className="mt-6 space-y-4">
              {[
                { k: "Terrain", v: scores.terrain, w: weights.terrain },
                { k: "Illumination", v: scores.illumination, w: weights.illumination },
                { k: "Communication", v: scores.communication, w: weights.communication },
                { k: "Space weather", v: scores.spaceWeather, w: weights.spaceWeather },
              ].map((f) => (
                <div key={f.k}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{f.k}</span>
                    <span className="metric text-muted-foreground">
                      {f.v} <span className="text-xs">· {f.w}%</span>
                    </span>
                  </div>
                  <ScoreBar value={f.v} tone={scoreTone(f.v)} />
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span>Data confidence</span>
                <span className="metric">
                  {scores.confidence} <span className="text-xs text-muted-foreground">· {weights.confidence}%</span>
                </span>
              </div>
            </div>
            <button onClick={() => setShowAdvanced((v) => !v)} className="mt-5 text-sm text-primary hover:underline">
              {showAdvanced ? "Hide" : "Show"} advanced parameters
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-3">
                {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
                  <label key={k} className="block text-sm">
                    <span className="flex justify-between capitalize">
                      <span>{k.replace(/([A-Z])/g, " $1")}</span>
                      <span className="metric">{weights[k]}%</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={weights[k]}
                      onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                      className="w-full accent-primary"
                    />
                  </label>
                ))}
                <Button variant="ghost" className="px-0" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                  Reset weights
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="How it was derived">
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li><span className="text-foreground">Terrain</span> — penalises mean slope, slopes above 15° and roughness across the landing zone.</li>
              <li><span className="text-foreground">Illumination</span> — sunlit share of the selected window plus current Sun elevation.</li>
              <li><span className="text-foreground">Communication</span> — Earth visibility share, relay coverage share and current link state.</li>
              <li><span className="text-foreground">Space weather</span> — current activity level mapped to a review scale; not a probability.</li>
              <li><span className="text-foreground">Confidence</span> — HIGH: literature-documented site; MEDIUM: partial coverage; LOW: modelled terrain.</li>
            </ul>
          </Panel>

          <Panel title="Provenance">
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between"><span className="text-muted-foreground">Sun / Earth geometry</span><Badge tone="favorable">Computed</Badge></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Relay positions</span><Badge tone="caution">Simulated</Badge></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Terrain descriptors</span><Badge tone={custom ? "unknown" : "earth"}>{custom ? "Modelled" : "Literature est."}</Badge></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Space weather</span><Badge tone={weather.data?.provenance === "LIVE" ? "favorable" : "caution"}>{weather.data?.provenance === "LIVE" ? "Live" : weather.isLoading ? "Loading" : "Demo simulation"}</Badge></li>
            </ul>
          </Panel>
          <Disclaimer />
        </div>
      </div>
    </div>
  );
}
