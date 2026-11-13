import paper from 'paper'

/** A canvas with its own paper.js scope, y axis pointing up. */
export type Scene = {
  paper: paper.PaperScope
  /** Removes everything drawn and resets the layer and view transforms. */
  clear(): void
  /** Removes handlers, stops onFrame, clears the project and releases the scope. Idempotent. */
  dispose(): void
  /** Inner canvas height (from the `height` attribute). */
  height: number
  /**
   * How much a step player enlarges canvas text because the canvas is shown small (1: not at
   * all), set before each render. Modules that lay out labels themselves size them by it and
   * mark them data.fixedSize; StepPlayer scales the other texts after the render.
   */
  textScale?: number
}

const teardowns = new WeakMap<Scene, () => void>()

/** Registers the cleanup of the current run on a scene; `dispose()` calls it. */
export function setSceneTeardown(scene: Scene, fn: (() => void) | undefined) {
  if (fn) teardowns.set(scene, fn)
  else teardowns.delete(scene)
}

export function takeSceneTeardown(scene: Scene): (() => void) | undefined {
  const fn = teardowns.get(scene)
  teardowns.delete(scene)
  return fn
}

/** Removes every `type` handler of a view (paper's typings only declare the object form of off()). */
export function offAll(view: paper.View, type: string) {
  ;(view as unknown as { off(type: string): void }).off(type)
}

/** Mouse, key and resize events user code can attach to a view, as handler property and event type. */
const VIEW_INPUT_EVENTS = {
  onMouseDown: 'mousedown',
  onMouseUp: 'mouseup',
  onMouseMove: 'mousemove',
  onMouseDrag: 'mousedrag',
  onClick: 'click',
  onDoubleClick: 'doubleclick',
  onMouseEnter: 'mouseenter',
  onMouseLeave: 'mouseleave',
  onKeyDown: 'keydown',
  onKeyUp: 'keyup',
  onResize: 'resize',
} as const

/** Removes every mouse, key and resize handler of a view: the `on*` properties and those added with on(). */
export function offInputHandlers(view: paper.View) {
  const props = view as unknown as Record<string, unknown>
  for (const [prop, type] of Object.entries(VIEW_INPUT_EVENTS)) {
    props[prop] = null
    offAll(view, type)
  }
}

/** Matrix that makes y point up inside a canvas of the given height. */
export const flipMatrix = (height: number) => new paper.Matrix(1, 0, 0, -1, 0, height)

export function createScene(canvas: HTMLCanvasElement): Scene {
  // paper.js rewrites the canvas size for HiDPI screens; remember the original
  // inner size so a canvas can be set up again (e.g. React StrictMode).
  const width = Number(canvas.dataset.sceneWidth ?? canvas.width)
  const height = Number(canvas.dataset.sceneHeight ?? canvas.height)
  canvas.dataset.sceneWidth = String(width)
  canvas.dataset.sceneHeight = String(height)

  const scope = new paper.PaperScope()
  scope.setup(canvas)
  scope.settings.applyMatrix = false // as in the legacy initials.js
  // The inner size is fixed; CSS scales the canvas, paper.js maps event points back.
  scope.view.viewSize = new scope.Size(width, height)
  canvas.style.width = '100%'
  canvas.style.height = 'auto'

  const layer = scope.project.activeLayer
  layer.applyMatrix = false
  layer.matrix = flipMatrix(height)

  let disposed = false
  const scene: Scene = {
    paper: scope,
    height,
    clear() {
      if (disposed) return
      scope.activate()
      for (const l of scope.project.layers.slice()) if (l !== layer) l.remove()
      layer.removeChildren()
      layer.matrix = flipMatrix(height)
      layer.activate()
      scope.view.matrix = new scope.Matrix()
      scope.view.requestUpdate()
    },
    dispose() {
      if (disposed) return
      takeSceneTeardown(scene)?.()
      disposed = true
      scope.view.onFrame = null
      offAll(scope.view, 'frame')
      scope.remove()
    },
  }
  return scene
}
