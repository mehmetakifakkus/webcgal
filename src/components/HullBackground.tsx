import { useEffect, useRef } from 'react';
import { convexHull } from '../geometry/algorithms/convexHull';
import type { Pt } from '../geometry/types';

const COUNT = 14;
/** speed in canvas fractions per second */
const SPEED = 0.025;

type Mover = Pt & { vx: number; vy: number };

function createPoints(): Mover[] {
  return Array.from({ length: COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const s = SPEED * (0.4 + Math.random() * 0.6);
    return { x: 0.08 + Math.random() * 0.84, y: 0.1 + Math.random() * 0.8, vx: Math.cos(a) * s, vy: Math.sin(a) * s };
  });
}

function move(points: Mover[], dt: number) {
  for (const p of points) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0.04 || p.x > 0.96) {
      p.vx = -p.vx;
      p.x = Math.min(0.96, Math.max(0.04, p.x));
    }
    if (p.y < 0.06 || p.y > 0.94) {
      p.vy = -p.vy;
      p.y = Math.min(0.94, Math.max(0.06, p.y));
    }
  }
}

function readColors(el: Element) {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return { accent: v('--accent', '#4f46e5'), point: v('--text-muted', '#5a6273') };
}

/**
 * Decorative canvas: drifting points and their live convex hull.
 * Pauses while the tab is hidden; draws a single frame when reduced motion is requested.
 */
export default function HullBackground({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const points = createPoints();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    let colors = readColors(canvas);
    let raf = 0;
    let last = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, w, h);
      // geometry uses y-up coordinates; flip for the canvas
      const toCanvas = (p: Pt) => [p.x * w, h - p.y * h] as const;
      const hull = convexHull(points);
      if (hull.length >= 3) {
        ctx.beginPath();
        hull.forEach((p, i) => {
          const [x, y] = toCanvas(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = colors.accent;
        ctx.fill();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.75 * dpr;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      const onHull = new Set(hull);
      for (const p of points) {
        const [x, y] = toCanvas(p);
        const hullPoint = onHull.has(p);
        ctx.globalAlpha = hullPoint ? 0.85 : 0.45;
        ctx.fillStyle = hullPoint ? colors.accent : colors.point;
        ctx.beginPath();
        ctx.arc(x, y, (hullPoint ? 3.5 : 2.75) * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw();
    };

    const frame = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      move(points, dt);
      draw();
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const start = () => {
      if (raf || reduced.matches || document.hidden) return;
      raf = requestAnimationFrame(frame);
    };
    const update = () => {
      if (reduced.matches || document.hidden) stop();
      else start();
    };
    const onScheme = () => {
      colors = readColors(canvas);
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    start();
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    dark.addEventListener('change', onScheme);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      reduced.removeEventListener('change', update);
      dark.removeEventListener('change', onScheme);
    };
  }, []);

  return <canvas ref={ref} className={className ? `hull-background ${className}` : 'hull-background'} aria-hidden="true" />;
}
