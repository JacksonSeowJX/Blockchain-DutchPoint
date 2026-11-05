import { useRef, useState } from "react";
import * as THREE from "three";

import { useScene } from "./useScene";

const NX = 170;
const NZ = 86;

type Props = { now: number; ridges: { at: number; size: number }[]; stopped: boolean };

/** A market surface of points. Left to right is the 20 minutes, each ridge is a bid, the bright line is now. */
export function Surface({ now, ridges, stopped }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ now, ridges, stopped });
  live.current = { now, ridges, stopped };
  const [failed, setFailed] = useState(false);

  useScene(
    ref,
    (canvas) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
      const count = NX * NZ;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 0.036, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      scene.add(new THREE.Points(geometry, material));
      const past = new THREE.Color("#7df3d6");
      const ahead = new THREE.Color("#2f9c8f");
      const bright = new THREE.Color("#ffffff");
      const mix = new THREE.Color();
      const pointer = { x: 0 };
      const onMove = (event: PointerEvent) => { pointer.x = event.clientX / window.innerWidth - 0.5; };
      window.addEventListener("pointermove", onMove);

      return {
        resize(width, height) {
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(1, height);
          camera.updateProjectionMatrix();
        },
        frame(time) {
          const state = live.current;
          const calm = state.stopped ? 0.35 : 1;
          for (let ix = 0; ix < NX; ix += 1) {
            const u = ix / (NX - 1);
            for (let iz = 0; iz < NZ; iz += 1) {
              const v = iz / (NZ - 1);
              const i = (ix * NZ + iz) * 3;
              // The price slope, a slow swell, and a ridge for each bid.
              let y = (1 - u) * 1.15 + Math.sin(u * 9 + v * 6 + time * 0.5) * 0.05 * calm + Math.sin(v * 11 - time * 0.35) * 0.035 * calm;
              for (const ridge of state.ridges) {
                const d = (u - ridge.at) / 0.022;
                y += Math.exp(-d * d) * ridge.size * Math.sin(v * Math.PI);
              }
              positions[i] = (u - 0.5) * 11;
              positions[i + 1] = y;
              positions[i + 2] = (v - 0.5) * 5.6;
              const gap = Math.abs(u - state.now);
              if (gap < 0.0065) mix.copy(bright);
              else mix.copy(u < state.now ? past : ahead);
              const fade = 0.6 + 0.4 * v;
              colors[i] = mix.r * fade;
              colors[i + 1] = mix.g * fade;
              colors[i + 2] = mix.b * fade;
            }
          }
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.color.needsUpdate = true;
          camera.position.set(pointer.x * 0.8 - 0.6, 3, 7.4);
          camera.lookAt(-0.6, 1.45, 0);
          renderer.render(scene, camera);
        },
        dispose() {
          window.removeEventListener("pointermove", onMove);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
        }
      };
    },
    () => setFailed(true),
    `${now}`
  );

  return failed ? null : <canvas ref={ref} className="immersive-canvas" aria-hidden="true" />;
}
