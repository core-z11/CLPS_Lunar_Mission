import { useEffect, useRef, useState } from "react";
import { formatAz, formatDeg } from "@/lib/astro";
import { Badge } from "./kit";

/** Lightweight camera overlay. No AR tracking — manual alignment only. */
export function CameraMode({
  onClose,
  siteName,
  sun,
  earth,
  status,
}: {
  onClose: () => void;
  siteName: string;
  sun: { elevation: number; azimuth: number };
  earth: { elevation: number; azimuth: number };
  status: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not available on this device or browser.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setError("Camera permission was denied or no camera was found."));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-background">
      {!error && <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />}
      {error && <div className="absolute inset-0 starfield" />}
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-xs text-foreground">LunaSight camera</p>
            <p className="mt-1 text-sm text-muted-foreground">Point at the Moon and align it inside the ring.</p>
          </div>
          <button onClick={onClose} className="panel px-3 py-1.5 font-mono text-xs">
            EXIT ✕
          </button>
        </div>
        <div className="pointer-events-none mx-auto h-56 w-56 rounded-full border-2 border-dashed border-primary/80">
          <p className="mt-[calc(100%+8px)] text-center font-mono text-xs text-primary">MOON · MANUAL ALIGNMENT</p>
        </div>
        <div className="panel grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-4">
          <div>
            <p className="label-xs">Landing site</p>
            <p className="mt-1 truncate">{siteName}</p>
          </div>
          <div>
            <p className="label-xs">Sun direction</p>
            <p className="metric mt-1 text-sun">
              {formatAz(sun.azimuth)} · {formatDeg(sun.elevation)}
            </p>
          </div>
          <div>
            <p className="label-xs">Earth direction</p>
            <p className="metric mt-1 text-earth">
              {formatAz(earth.azimuth)} · {formatDeg(earth.elevation)}
            </p>
          </div>
          <div>
            <p className="label-xs">Mission status</p>
            <Badge tone="caution" className="mt-1">{status}</Badge>
          </div>
          {error && <p className="col-span-full text-xs text-caution">{error} Showing overlay only.</p>}
        </div>
      </div>
    </div>
  );
}
