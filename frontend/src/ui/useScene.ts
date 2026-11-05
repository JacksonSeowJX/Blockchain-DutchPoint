import { RefObject, useEffect, useRef } from "react";

export type Scene = {
  resize: (width: number, height: number) => void;
  frame: (time: number, delta: number) => void;
  dispose: () => void;
};

/**
 * Runs a canvas scene: sizes it to its element, pauses it off screen, and draws a single still frame
 * per data change when the viewer prefers reduced motion. Returns false through `onFail` if the
 * browser has no WebGL, so the layout can show its plain figures instead.
 */
export function useScene(
  ref: RefObject<HTMLCanvasElement | null>,
  create: (canvas: HTMLCanvasElement) => Scene,
  onFail: () => void,
  stillKey?: unknown
) {
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let scene: Scene;
    try {
      scene = create(canvas);
    } catch {
      onFail();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const draw = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      scene.frame(now / 1000, delta);
      if (!reduced && visible) raf = requestAnimationFrame(draw);
    };
    redraw.current = () => draw(performance.now());
    const sizer = new ResizeObserver(() => {
      scene.resize(canvas.clientWidth, canvas.clientHeight);
      if (reduced) redraw.current();
    });
    sizer.observe(canvas);
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    });
    watcher.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      sizer.disconnect();
      watcher.disconnect();
      scene.dispose();
    };
    // The scene is created once; live data reaches it through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) redraw.current();
  }, [stillKey]);
}
