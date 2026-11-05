import { useRef, useState } from "react";
import * as THREE from "three";

import { useScene } from "./useScene";

const RINGS = 21; // one per minute, 0 to 20
const LEDS = 220;
const GAP = 3.2;
const RADIUS = 3;

type Props = { minute: number; bidMinutes: number[]; stopped: boolean; travel: () => number };

/** A shaft of LED rings, one per minute. The camera sits at the live minute; scrolling flies ahead. */
export function Tunnel({ minute, bidMinutes, stopped, travel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ minute, bidMinutes, stopped });
  live.current = { minute, bidMinutes, stopped };
  const [failed, setFailed] = useState(false);

  useScene(
    ref,
    (canvas) => {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x000000, 0.016);
      const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);

      const total = RINGS * LEDS;
      const positions = new Float32Array(total * 3);
      const colors = new Float32Array(total * 3);
      for (let r = 0; r < RINGS; r += 1) {
        for (let l = 0; l < LEDS; l += 1) {
          const angle = (l / LEDS) * Math.PI * 2;
          const i = (r * LEDS + l) * 3;
          positions[i] = Math.cos(angle) * RADIUS;
          positions[i + 1] = Math.sin(angle) * RADIUS;
          positions[i + 2] = -r * GAP;
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      scene.add(new THREE.Points(geometry, material));

      // The pointer: a beam from the axis to the live ring, turning once a minute.
      const beam = new THREE.Mesh(new THREE.BoxGeometry(RADIUS, 0.022, 0.022), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
      beam.geometry.translate(RADIUS / 2, 0, 0);
      const pivot = new THREE.Group();
      pivot.add(beam);
      scene.add(pivot);

      const high = new THREE.Color("#ff2d3f");
      const low = new THREE.Color("#2bd4ff");
      const mix = new THREE.Color();
      const pointer = { x: 0, y: 0 };
      const onMove = (event: PointerEvent) => {
        pointer.x = event.clientX / window.innerWidth - 0.5;
        pointer.y = event.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onMove);
      let camZ = 4;

      return {
        resize(width, height) {
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(1, height);
          camera.updateProjectionMatrix();
        },
        frame(time) {
          const state = live.current;
          for (let r = 0; r < RINGS; r += 1) {
            const passed = r < state.minute;
            const current = r === Math.floor(state.minute);
            const hasBid = state.bidMinutes.includes(r);
            mix.copy(high).lerp(low, r / (RINGS - 1));
            // Spent rings fade out quickly, so none of them passes the camera as giant dots.
            const behind = state.minute - r;
            const pulse = current ? 1.7 + Math.sin(time * 5) * 0.3 : passed ? (behind < 1.6 ? 0.22 : 0) : 1.15;
            for (let l = 0; l < LEDS; l += 1) {
              const i = (r * LEDS + l) * 3;
              const dash = hasBid && l % 22 < 11 ? 1.9 : 1;
              const wave = current ? 1 : 0.72 + Math.sin(l * 0.3 + time * 2 + r) * 0.28;
              const glow = pulse * dash * wave;
              colors[i] = (state.stopped && current ? 1 : mix.r) * glow;
              colors[i + 1] = (state.stopped && current ? 1 : mix.g) * glow;
              colors[i + 2] = (state.stopped && current ? 1 : mix.b) * glow;
            }
          }
          geometry.attributes.color.needsUpdate = true;
          const liveZ = -state.minute * GAP;
          pivot.position.z = liveZ;
          pivot.rotation.z = state.stopped ? 0.6 : -time * ((Math.PI * 2) / 60) * 6;
          const target = liveZ + 3.4 - travel() * (20 * GAP + liveZ + 3.4);
          camZ += (target - camZ) * 0.08;
          camera.position.set(pointer.x * 0.9, -pointer.y * 0.9, camZ);
          camera.rotation.set(pointer.y * -0.08, pointer.x * -0.12, 0);
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
    `${minute}`
  );

  return failed ? null : <canvas ref={ref} className="immersive-canvas" aria-hidden="true" />;
}
