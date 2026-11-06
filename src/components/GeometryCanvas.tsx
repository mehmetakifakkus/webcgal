import { useEffect, useRef } from 'react';
import { createScene, type Scene } from '../engine/scene';

type Props = {
  width: number;
  height: number;
  /** Called every time a scene is created (React StrictMode may do so twice). */
  onReady?: (scene: Scene) => void;
  id?: string;
};

const debugEnabled = Boolean(import.meta.env.DEV || import.meta.env.VITE_E2E);

/** A canvas with its own paper.js scene; the scene is disposed on unmount. */
export default function GeometryCanvas({ width, height, onReady, id }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createScene(canvas);
    if (debugEnabled) window.__webcgalDebug = { scene };
    onReadyRef.current?.(scene);
    return () => {
      if (debugEnabled && window.__webcgalDebug?.scene === scene) delete window.__webcgalDebug;
      scene.dispose();
    };
  }, []);

  return (
    <div className="canvas-frame" style={{ maxWidth: width }}>
      <canvas ref={canvasRef} id={id} width={width} height={height} aria-label="Drawing canvas" />
    </div>
  );
}
