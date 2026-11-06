import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type paper from 'paper'
import GeometryCanvas from './GeometryCanvas'
import PseudocodePanel from './PseudocodePanel'
import StatePanel from './StatePanel'
import type { Scene } from '../engine/scene'
import type { Pt } from '../geometry/types'
import type { PlayerModule } from '../players/types'
import './StepPlayer.css'

/** Canvas size in scene units when the module does not set one. */
const DEFAULT_CANVAS = { width: 775, height: 360 }
/** Grab radius in CSS pixels (and at least this many scene units). */
const GRAB = 12

/** Keys are ignored while typing in a form control or the code editor. */
function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof Element)) return false
  return Boolean(t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor'))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function StepPlayer({ module }: { module: PlayerModule<any, any> }) {
  // the input's type is only known to the module: the player reaches it through handles/moveHandle
  const [input, setInput] = useState<unknown>(() => module.randomInput())
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(5)
  const [scene, setScene] = useState<Scene | null>(null)
  const inputRef = useRef(input)
  const presetId = useId()
  const { width, height } = module.canvas ?? DEFAULT_CANVAS

  const steps = useMemo(() => module.computeSteps(input), [module, input])
  const last = steps.length - 1
  const step = steps[Math.min(index, last)]
  const panels = useMemo(() => (step ? (module.panels?.(step, input) ?? []) : []), [module, step, input])

  const replaceInput = useCallback((next: unknown) => {
    inputRef.current = next
    setInput(next)
    setIndex(0)
    setPlaying(false)
  }, [])

  // draw the current step
  useEffect(() => {
    if (scene && step) module.render(scene, step, input)
  }, [scene, module, step, input])

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

  // keyboard: inside the player region (focusable), or with nothing focused while the player is in view;
  // never on tabs, links or text inputs, and Space never on a button (it activates the button itself)
  const containerRef = useRef<HTMLDivElement>(null)
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const container = containerRef.current
    const t = e.target
    if (!container || !(t instanceof Element)) return
    if (t === document.body || t === document.documentElement) {
      const r = container.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= window.innerHeight) return
    } else if (!container.contains(t)) return
    if (isTypingTarget(t) || t.closest('a, [role="tab"]')) return
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else if (e.key === ' ' || e.code === 'Space') {
      if (t.closest('button')) return
      togglePlay()
    } else return
    e.preventDefault()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e)
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // dragging handles: view-level handlers survive the redraws that follow every move
  useEffect(() => {
    if (!scene) return
    const view = scene.paper.view
    let dragging = -1
    let raf = 0
    const toPt = (p: paper.Point): Pt => ({ x: p.x, y: scene.height - p.y }) // the layer is y-flipped
    view.onMouseDown = (e: paper.MouseEvent) => {
      const q = toPt(e.point)
      // the canvas is scaled down on narrow screens: convert the radius to scene units
      const shown = (view.element as HTMLCanvasElement).clientWidth
      let best = -1
      let bestD = GRAB * Math.max(1, shown > 0 ? view.viewSize.width / shown : 1)
      module.handles(inputRef.current).forEach((p, i) => {
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
      const clamped = { x: Math.max(0, Math.min(width, q.x)), y: Math.max(0, Math.min(height, q.y)) }
      inputRef.current = module.moveHandle(inputRef.current, dragging, clamped)
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          setInput(inputRef.current)
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
  }, [scene, module, width, height])

  return (
    <div ref={containerRef} className="step-player" tabIndex={0} aria-label="Step by step player">
      <div className="step-player-main">
        <GeometryCanvas width={width} height={height} onReady={setScene} />
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
          <button type="button" className="btn" onClick={() => replaceInput(module.randomInput())}>
            <Icon d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5" stroke />
            New random input
          </button>
          {module.presets?.length ? (
            <div className="step-player-preset">
              {/* a separate label: inside it, the select's own text would join its accessible name */}
              <label htmlFor={presetId}>Preset</label>
              <select
                id={presetId}
                className="select"
                value=""
                onChange={(e) => {
                  if (e.target.value === '') return
                  const preset = module.presets?.[Number(e.target.value)]
                  if (preset) replaceInput(preset.input)
                }}
              >
                <option value="">Choose a preset…</option>
                {module.presets.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="step-player-status">
          <p className="step-player-counter">Step {index + 1} / {steps.length}</p>
          <div className="step-player-progress" aria-hidden="true">
            <span style={{ width: `${steps.length > 1 ? (Math.min(index, last) / last) * 100 : 100}%` }} />
          </div>
        </div>
        <p className="step-player-description" aria-live="polite">{step?.description}</p>
        <p className="step-player-hint">Drag the handles to change the input. Keys: ← → to step, Space to play or pause.</p>
      </div>
      <div className="step-player-side">
        <PseudocodePanel lines={module.pseudocode} active={step?.line ?? -1} />
        {panels.map((panel, i) => (
          <StatePanel key={i} panel={panel} />
        ))}
      </div>
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
