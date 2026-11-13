import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type paper from 'paper'
import GeometryCanvas from './GeometryCanvas'
import PseudocodePanel from './PseudocodePanel'
import StatePanel from './StatePanel'
import type { Scene } from '../engine/scene'
import type { Pt } from '../geometry/types'
import { cssColor } from '../players/cssColor'
import type { PlayerModule } from '../players/types'
import './StepPlayer.css'

/** Canvas size in scene units when the module does not set one. */
const DEFAULT_CANVAS = { width: 775, height: 360 }
/** Help line when the module does not set one. */
const DEFAULT_HINT = 'Drag the points to change the input. Keys: ← → to step, Space to play or pause.'
/** Grab radius in CSS pixels (and at least this many scene units). */
const GRAB = 12
/** A press and release on a handle moving less than this many CSS pixels is a click (modules with clickHandle). */
const CLICK_SLOP = 3
/** Radius of the handles drawn for an invalid input when the module has no renderInvalid. */
const HANDLE_RADIUS = 4
/** Canvas text grows by at most this factor when the canvas is shown small. */
const MAX_TEXT_SCALE = 1.6
/**
 * Shown at this fraction of its scene size or more, the canvas keeps its text sizes (on desktop
 * the page shows the 775-unit canvas at 679 px, s = 0.876).
 */
const SMALL_CANVAS = 0.8

/**
 * Scales the texts of the scene by SMALL_CANVAS / s, at most MAX_TEXT_SCALE, where s is the
 * canvas's CSS width over its width in scene units, once s < SMALL_CANVAS: on a phone, where the
 * whole canvas is shown small, the labels stay readable; at s ≥ SMALL_CANVAS (desktop) the
 * modules' sizes are kept. Texts with data.fixedSize (labels inside a node's shape) are skipped.
 * A text keeps its anchor (its point, with its justification), and its module size is kept in
 * data.baseFontSize, so repeated passes (after every render and on every resize) do not compound.
 */
function scaleCanvasText(scene: Scene) {
  const view = scene.paper.view
  const shown = (view.element as HTMLCanvasElement).getBoundingClientRect().width
  if (!(shown > 0)) return // not laid out (yet)
  const s = shown / view.viewSize.width
  const factor = s >= SMALL_CANVAS ? 1 : Math.min(SMALL_CANVAS / s, MAX_TEXT_SCALE)
  for (const item of scene.paper.project.getItems({ class: scene.paper.PointText }) as paper.PointText[]) {
    const data = item.data as { baseFontSize?: number; fixedSize?: boolean }
    if (data.fixedSize) continue
    data.baseFontSize ??= parseFloat(String(item.fontSize))
    if (!Number.isFinite(data.baseFontSize)) continue
    const size = data.baseFontSize * factor
    if (item.fontSize !== size) item.fontSize = size
  }
}

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
  /** Index of the loaded preset as the select's value; "" once the input changes otherwise. */
  const [preset, setPreset] = useState('')
  /** The selected mode's id; kept when the input changes. */
  const [mode, setMode] = useState<string | undefined>(() => module.modes?.[0]?.id)
  const inputRef = useRef(input)
  /** The mode for the canvas handlers, which are not set up again when it changes. */
  const modeRef = useRef(mode)
  modeRef.current = mode
  /** The last input that passed `validate`: a drag that ends on an invalid input reverts to it. */
  const lastValidRef = useRef(input)
  /** The draggable handles of `inp` in mode `m`; modules without modes get the call they were written for. */
  const handlesOf = useCallback(
    (inp: unknown, m: string | undefined): Pt[] => (m === undefined ? module.handles(inp) : module.handles(inp, m)),
    [module],
  )
  const presetId = useId()
  const modeId = useId()
  const { width, height } = module.canvas ?? DEFAULT_CANVAS

  const invalid = useMemo(() => module.validate?.(input) ?? null, [module, input])
  // modules without modes get the call they were written for
  const steps = useMemo(
    () => (invalid !== null ? [] : mode === undefined ? module.computeSteps(input) : module.computeSteps(input, mode)),
    [module, input, mode, invalid],
  )
  const dimmed = useMemo(() => module.dimmedLines?.(mode), [module, mode])
  const last = steps.length - 1
  const step = steps[Math.min(index, last)]
  const panels = useMemo(() => (step ? (module.panels?.(step, input) ?? []) : []), [module, step, input])

  const replaceInput = useCallback((next: unknown, presetValue = '') => {
    inputRef.current = next
    if ((module.validate?.(next) ?? null) === null) lastValidRef.current = next
    setInput(next)
    setPreset(presetValue)
    setIndex(0)
    setPlaying(false)
  }, [module])

  // draw the current step, or the invalid input
  useEffect(() => {
    if (!scene) return
    if (invalid === null) {
      if (step) module.render(scene, step, input)
    } else if (module.renderInvalid) module.renderInvalid(scene, input)
    else {
      const P = scene.paper
      P.activate()
      scene.clear()
      const ink = cssColor('--canvas-ink', '#1c1e21')
      for (const q of handlesOf(input, mode))
        new P.Path.Circle({ center: new P.Point(q.x, q.y), radius: HANDLE_RADIUS, fillColor: ink })
    }
    // after the module's render, which stays pure: the module draws at scene sizes
    scaleCanvasText(scene)
  }, [scene, module, step, input, invalid, handlesOf, mode])

  // the canvas is shown at another size (window resized, phone rotated): scale the text again
  useEffect(() => {
    if (!scene || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => scaleCanvasText(scene))
    observer.observe(scene.paper.view.element)
    return () => observer.disconnect()
  }, [scene])

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
    if (invalid !== null) return // nothing to step through
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
    // with clickHandle, a pressed handle only starts dragging once it has moved CLICK_SLOP px
    let pressed = -1
    let pressedAt: paper.Point | null = null
    let slop = 0
    let raf = 0
    const toPt = (p: paper.Point): Pt => ({ x: p.x, y: scene.height - p.y }) // the layer is y-flipped
    view.onMouseDown = (e: paper.MouseEvent) => {
      const q = toPt(e.point)
      // the canvas is scaled down on narrow screens: convert the radius to scene units
      const shown = (view.element as HTMLCanvasElement).clientWidth
      const unitsPerPx = shown > 0 ? view.viewSize.width / shown : 1
      let best = -1
      let bestD = GRAB * Math.max(1, unitsPerPx)
      handlesOf(inputRef.current, modeRef.current).forEach((p, i) => {
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        if (d <= bestD) {
          best = i
          bestD = d
        }
      })
      if (module.clickHandle) {
        dragging = -1
        pressed = best
        pressedAt = e.point.clone()
        slop = CLICK_SLOP * unitsPerPx
      } else dragging = best
    }
    view.onMouseDrag = (e: paper.MouseEvent) => {
      if (pressed >= 0) {
        if (!pressedAt || e.point.getDistance(pressedAt) < slop) return // still a click
        dragging = pressed
        pressed = -1
      }
      if (dragging < 0) return
      const q = toPt(e.point)
      const clamped = { x: Math.max(0, Math.min(width, q.x)), y: Math.max(0, Math.min(height, q.y)) }
      const next = module.moveHandle(inputRef.current, dragging, clamped, modeRef.current)
      if (next === inputRef.current) return // the module keeps the handle where it is
      // the handle follows the mouse even onto an invalid input (the alert shows); release reverts
      if ((module.validate?.(next) ?? null) === null) lastValidRef.current = next
      inputRef.current = next
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          setInput(inputRef.current)
          setPreset('')
          setIndex(0)
          setPlaying(false)
        })
    }
    view.onMouseUp = () => {
      if (pressed >= 0) {
        const k = pressed
        pressed = -1
        const current = inputRef.current
        const next = module.clickHandle?.(current, k, modeRef.current) ?? current
        if (next === current) return
        // a click changes what is placed on the input (e.g. cameras), not its geometry: the loaded
        // preset stays selected
        inputRef.current = next
        if ((module.validate?.(next) ?? null) === null) lastValidRef.current = next
        setInput(next)
        setIndex(0)
        setPlaying(false)
        return
      }
      const wasDragging = dragging >= 0
      dragging = -1
      if (wasDragging && (module.validate?.(inputRef.current) ?? null) !== null) {
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
        replaceInput(lastValidRef.current)
      }
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
      view.onMouseDown = null
      view.onMouseDrag = null
      view.onMouseUp = null
    }
  }, [scene, module, width, height, replaceInput, handlesOf])

  return (
    <div ref={containerRef} className="step-player" tabIndex={0} aria-label="Step by step player">
      <div className="step-player-main">
        <div className="step-player-stage">
          {invalid !== null ? (
            // as wide as the canvas frame (not the column), so it covers no more of the drawing than needed
            <div role="alert" className="step-player-alert" style={{ maxWidth: width }}>
              {invalid}
            </div>
          ) : null}
          <GeometryCanvas width={width} height={height} onReady={setScene} />
        </div>
        <div className="step-player-controls" role="group" aria-label="Player controls">
          <div className="step-player-transport">
            <button type="button" className="btn btn-ghost" onClick={() => go(0)} aria-label="First" title="First" disabled={invalid !== null}>
              <Icon d="M5 4v16M19 4L8 12l11 8z" /><span className="btn-label">First</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(index - 1)} aria-label="Previous" title="Previous" disabled={invalid !== null}>
              <Icon d="M17 4L6 12l11 8z" /><span className="btn-label">Previous</span>
            </button>
            <button
              type="button"
              className="btn btn-primary step-player-play"
              onClick={togglePlay}
              disabled={invalid !== null}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Icon d="M7 4h4v16H7zM13 4h4v16h-4z" /> : <Icon d="M7 4l12 8-12 8z" />}
              <span className="btn-label">{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(index + 1)} aria-label="Next" title="Next" disabled={invalid !== null}>
              <Icon d="M7 4l11 8-11 8z" /><span className="btn-label">Next</span>
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => go(last)} aria-label="Last" title="Last" disabled={invalid !== null}>
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
          {module.modes?.length ? (
            <div className="step-player-mode">
              <label htmlFor={modeId}>Mode</label>
              <select
                id={modeId}
                className="select"
                value={mode}
                disabled={invalid !== null}
                onChange={(e) => {
                  setMode(e.target.value)
                  setIndex(0)
                  setPlaying(false)
                }}
              >
                {module.modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {module.presets?.length ? (
            <div className="step-player-preset">
              {/* a separate label: inside it, the select's own text would join its accessible name */}
              <label htmlFor={presetId}>Preset</label>
              <select
                id={presetId}
                className="select"
                value={preset}
                disabled={invalid !== null}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') return setPreset('') // the placeholder leaves the input as it is
                  const chosen = module.presets?.[Number(v)]
                  if (chosen) replaceInput(chosen.input, v)
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
          <p className="step-player-counter">
            {invalid !== null ? 'Step – / –' : `Step ${index + 1} / ${steps.length}`}
          </p>
          <div className="step-player-progress" aria-hidden="true">
            <span style={{ width: `${invalid !== null ? 0 : steps.length > 1 ? (Math.min(index, last) / last) * 100 : 100}%` }} />
          </div>
        </div>
        <p className="step-player-description" aria-live="polite">
          {invalid !== null ? 'Release the mouse to return to the last valid polygon' : step?.description}
        </p>
        <p className="step-player-hint">{module.hint ?? DEFAULT_HINT}</p>
        {panels.length ? (
          // state panels stay under the canvas, so they can be watched while stepping
          <div className="step-player-panels">
            {panels.map((panel, i) => (
              <StatePanel key={i} panel={panel} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="step-player-side">
        <PseudocodePanel lines={module.pseudocode} active={step?.line ?? -1} dimmed={dimmed} />
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
