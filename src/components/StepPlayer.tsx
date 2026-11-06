import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type paper from 'paper'
import GeometryCanvas from './GeometryCanvas'
import PseudocodePanel from './PseudocodePanel'
import type { Scene } from '../engine/scene'
import type { Pt } from '../geometry/types'
import type { PlayerModule } from '../players/types'
import './StepPlayer.css'

const WIDTH = 775
const HEIGHT = 360
const GRAB = 12

/** Keys are ignored while typing in a form control or the code editor. */
function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof Element)) return false
  return Boolean(t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor'))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StepPlayer({ module }: { module: PlayerModule<any> }) {
  const [points, setPoints] = useState<Pt[]>(() => module.initialPoints())
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [scene, setScene] = useState<Scene | null>(null)
  const pointsRef = useRef(points)

  const steps = useMemo(() => module.computeSteps(points), [module, points])
  const last = steps.length - 1
  const step = steps[Math.min(index, last)]

  const replacePoints = useCallback((next: Pt[]) => {
    pointsRef.current = next
    setPoints(next)
    setIndex(0)
    setPlaying(false)
  }, [])

  // draw the current step
  useEffect(() => {
    if (scene && step) module.render(scene, step, points)
  }, [scene, module, step, points])

  // playback
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setIndex((i) => Math.min(i + 1, last)), 1000 / speed)
    return () => clearInterval(id)
  }, [playing, speed, last])
  useEffect(() => {
    if (playing && index >= last) setPlaying(false)
  }, [playing, index, last])

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, last))), [last])
  const togglePlay = useCallback(() => {
    if (playing) setPlaying(false)
    else {
      if (index >= last) setIndex(0)
      setPlaying(true)
    }
  }, [playing, index, last])

  // keyboard: the player region (focusable) and anywhere else on the page except text inputs
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    if (isTypingTarget(e.target)) return
    const onControl = e.target instanceof Element && e.target.closest('button, a, [role="tab"]')
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else if (e.key === ' ' || e.code === 'Space') {
      if (onControl) return // Space activates the focused button itself
      togglePlay()
    } else return
    e.preventDefault()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e)
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // dragging points: view-level handlers survive the redraws that follow every move
  useEffect(() => {
    if (!scene) return
    const view = scene.paper.view
    let dragging = -1
    let raf = 0
    const toPt = (p: paper.Point): Pt => ({ x: p.x, y: scene.height - p.y }) // the layer is y-flipped
    view.onMouseDown = (e: paper.MouseEvent) => {
      const q = toPt(e.point)
      let best = -1
      let bestD = GRAB
      pointsRef.current.forEach((p, i) => {
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        if (d <= bestD) {
          best = i
          bestD = d
        }
      })
      dragging = best
    }
    view.onMouseDrag = (e: paper.MouseEvent) => {
      if (dragging < 0) return
      const q = toPt(e.point)
      const next = pointsRef.current.slice()
      next[dragging] = { x: Math.max(0, Math.min(WIDTH, q.x)), y: Math.max(0, Math.min(HEIGHT, q.y)) }
      pointsRef.current = next
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          setPoints(pointsRef.current)
          setIndex(0)
          setPlaying(false)
        })
    }
    view.onMouseUp = () => {
      dragging = -1
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
      view.onMouseDown = null
      view.onMouseDrag = null
      view.onMouseUp = null
    }
  }, [scene])

  return (
    <div className="step-player" tabIndex={0} aria-label="Step by step player">
      <div className="step-player-main">
        <GeometryCanvas width={WIDTH} height={HEIGHT} onReady={setScene} />
        <div className="step-player-controls" role="group" aria-label="Player controls">
          <button type="button" onClick={() => go(0)} aria-label="First" title="First">⏮</button>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous" title="Previous">◀</button>
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next" title="Next">▷</button>
          <button type="button" onClick={() => go(last)} aria-label="Last" title="Last">⏭</button>
          <label className="step-player-speed">
            Speed
            <input type="range" min={1} max={10} step={1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <button type="button" onClick={() => replacePoints(module.initialPoints())}>New random points</button>
        </div>
        <p className="step-player-counter">Step {index + 1} / {steps.length}</p>
        <p className="step-player-description" aria-live="polite">{step?.description}</p>
        <p className="step-player-hint">Drag the points to change the input. Keys: ← → to step, Space to play or pause.</p>
      </div>
      <PseudocodePanel lines={module.pseudocode} active={step?.line ?? -1} />
    </div>
  )
}
