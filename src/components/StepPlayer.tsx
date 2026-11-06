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
          <div className="step-player-transport">
            <button type="button" className="btn btn-ghost" onClick={() => go(0)} aria-label="First" title="First">
              <Icon d="M5 4v16M19 4L8 12l11 8z" /><span className="btn-label">First</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(index - 1)} aria-label="Previous" title="Previous">
              <Icon d="M17 4L6 12l11 8z" /><span className="btn-label">Previous</span>
            </button>
            <button
              type="button"
              className="btn btn-primary step-player-play"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Icon d="M7 4h4v16H7zM13 4h4v16h-4z" /> : <Icon d="M7 4l12 8-12 8z" />}
              <span className="btn-label">{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(index + 1)} aria-label="Next" title="Next">
              <Icon d="M7 4l11 8-11 8z" /><span className="btn-label">Next</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(last)} aria-label="Last" title="Last">
              <Icon d="M19 4v16M5 4l11 8-11 8z" /><span className="btn-label">Last</span>
            </button>
          </div>
          <label className="step-player-speed">
            Speed
            <input type="range" min={1} max={10} step={1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
          <button type="button" className="btn" onClick={() => replacePoints(module.initialPoints())}>
            <Icon d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5" stroke />
            New random points
          </button>
        </div>
        <div className="step-player-status">
          <p className="step-player-counter">Step {index + 1} / {steps.length}</p>
          <div className="step-player-progress" aria-hidden="true">
            <span style={{ width: `${steps.length > 1 ? (Math.min(index, last) / last) * 100 : 100}%` }} />
          </div>
        </div>
        <p className="step-player-description" aria-live="polite">{step?.description}</p>
        <p className="step-player-hint">Drag the points to change the input. Keys: ← → to step, Space to play or pause.</p>
      </div>
      <PseudocodePanel lines={module.pseudocode} active={step?.line ?? -1} />
    </div>
  )
}

/** Small inline icon; filled unless `stroke` is set. */
function Icon({ d, stroke }: { d: string; stroke?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={stroke ? 'icon icon-stroke' : 'icon'}>
      <path d={d} />
    </svg>
  )
}
