import { Canvas, useLoader, type ThreeEvent } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";
import type { V3 } from "@/lib/astro";

/** Moon body frame (x→lon 0, y→lon 90E, z→north) mapped to three.js (y-up). */
const toThree = (v: V3, s = 1): [number, number, number] => [v[0] * s, v[2] * s, -v[1] * s];

const latLonToBody = (lat: number, lon: number, r = 1): V3 => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.cos(la) * Math.sin(lo), r * Math.sin(la)];
};

export interface Moon3DRelay {
  id: string;
  name: string;
  position: V3; // km, body frame
  link: boolean;
}

function MoonSphere({ onPick }: { onPick?: ((lat: number, lon: number) => void) | undefined }) {
  const [colorT, heightT] = useLoader(THREE.TextureLoader, ["/textures/moon-color.jpg", "/textures/moon-height.jpg"]);
  const color = colorT!;
  const height = heightT!;
  color.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!onPick) return;
        e.stopPropagation();
        const p = e.point.clone().normalize();
        // three (x, y, z) → body (x, -z, y)
        const lat = (Math.asin(p.y) * 180) / Math.PI;
        const lon = (Math.atan2(-p.z, p.x) * 180) / Math.PI;
        onPick(lat, lon);
      }}
    >
      <sphereGeometry args={[1, 160, 160]} />
      <meshStandardMaterial map={color} displacementMap={height} displacementScale={0.018} roughness={1} metalness={0} />
    </mesh>
  );
}

export const Moon3D = memo(function Moon3D({
  site,
  sunDir,
  earthDir,
  relays,
  onPick,
}: {
  site: { lat: number; lon: number };
  sunDir: V3;
  earthDir: V3;
  relays: Moon3DRelay[];
  onPick?: (lat: number, lon: number) => void;
}) {
  const sitePos = useMemo(() => toThree(latLonToBody(site.lat, site.lon, 1.012)), [site.lat, site.lon]);
  const sunPos = toThree(sunDir, 2.6);
  const earthPos = toThree(earthDir, 2.3);
  const anyRelayLink = relays.some((r) => r.link);

  return (
    <Canvas camera={{ position: [1.5, -4.6, 2.9], fov: 40 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <ambientLight intensity={0.05} />
      <directionalLight position={toThree(sunDir, 10)} intensity={3.2} />
      <MoonSphere onPick={onPick} />

      {/* Landing site */}
      <mesh position={sitePos}>
        <sphereGeometry args={[0.014, 16, 16]} />
        <meshBasicMaterial color="#5fa8ff" />
      </mesh>
      <mesh position={sitePos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...sitePos).normalize())}>
        <ringGeometry args={[0.03, 0.036, 48]} />
        <meshBasicMaterial color="#5fa8ff" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      {/* Sun & Earth direction markers */}
      <mesh position={sunPos}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshBasicMaterial color="#f5c35b" />
      </mesh>
      <Line points={[sitePos, sunPos]} color="#f5c35b" lineWidth={1} dashed dashSize={0.05} gapSize={0.04} transparent opacity={0.5} />
      <mesh position={earthPos}>
        <sphereGeometry args={[0.09, 32, 32]} />
        <meshStandardMaterial color="#3d82d6" emissive="#1c4f8f" emissiveIntensity={0.6} />
      </mesh>
      <Line points={[sitePos, earthPos]} color="#6fb1ff" lineWidth={1.2} dashed={false} transparent opacity={0.45} />

      {/* Relays (scaled radius, compressed for display) */}
      {relays.map((r) => {
        const km = Math.hypot(...r.position);
        const disp = 1 + Math.min(1.1, (km - 1737.4) / 7000);
        const p = toThree([r.position[0] / km, r.position[1] / km, r.position[2] / km], disp);
        return (
          <group key={r.id}>
            <mesh position={p}>
              <octahedronGeometry args={[0.03]} />
              <meshBasicMaterial color={r.link ? "#7fe0e6" : "#7d8796"} />
            </mesh>
            {r.link && (
              <>
                <Line points={[sitePos, p]} color="#7fe0e6" lineWidth={1.4} transparent opacity={0.85} />
                <Line points={[p, earthPos]} color="#7fe0e6" lineWidth={0.8} transparent opacity={0.35} />
              </>
            )}
          </group>
        );
      })}
      {!anyRelayLink && null}
      <OrbitControls enablePan={false} minDistance={1.4} maxDistance={9} target={[0, -0.35, 0]} />
    </Canvas>
  );
});

export default Moon3D;
