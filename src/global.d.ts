import type { Scene } from './engine/scene';

declare global {
  interface Window {
    /** Set by GeometryCanvas in dev and VITE_E2E builds only, for tests. */
    __webcgalDebug?: { scene: Scene };
  }
}

export {};
