import paper from 'paper'
import { buildApi, createGuard } from './api'
import { errorText, stackLine, type OutputLine } from './output'
import { offAll, setSceneTeardown, takeSceneTeardown, type Scene } from './scene'

export type { OutputLine }

export type RunOptions = {
  scene: Scene
  output: (l: OutputLine) => void
  /** Canvases user code can reach with `document.getElementById(id)`. */
  extraCanvases?: Record<string, HTMLCanvasElement>
  /** Called by clearLog() / console.clear() in user code. */
  clearOutput?: () => void
}

export type RunResult = { ok: true } | { ok: false; error: OutputLine & { line?: number } }

// ---------------------------------------------------------------------------
// Legacy array helpers, installed once and non-enumerable (for...in stays clean).

function patchArray(name: string, value: (this: unknown[], ...args: never[]) => unknown) {
  if (!Object.prototype.hasOwnProperty.call(Array.prototype, name))
    Object.defineProperty(Array.prototype, name, { value, enumerable: false, configurable: true, writable: true })
}
/** Returns a copy without element n (negative counts from the end). Kept for old code. */
patchArray('delete', function (n: number) {
  const del = n < 0 ? this.length + n : n
  return this.slice(0, del).concat(this.slice(del + 1))
})
/** Empties the array in place. */
patchArray('clear', function () {
  this.length = 0
})

// ---------------------------------------------------------------------------
// PaperScript operator helpers. paper.js keeps its own copies private, so these
// mirror PaperScript.js: compiled code calls them for + - * / % == != on values
// that implement __add, __subtract... (Point, Size, Color).

const binaryOperators: Record<string, string> = {
  '+': '__add', '-': '__subtract', '*': '__multiply', '/': '__divide', '%': '__modulo', '==': '__equals', '!=': '__equals',
}
const unaryOperators: Record<string, string> = { '-': '__negate', '+': '__self' }

function __$__(left: any, operator: string, right: any): unknown {
  const handler = binaryOperators[operator]
  if (left && left[handler]) {
    const res = left[handler](right)
    return operator === '!=' ? !res : res
  }
  switch (operator) {
    case '+': return left + right
    case '-': return left - right
    case '*': return left * right
    case '/': return left / right
    case '%': return left % right
    case '==': return left == right
    case '!=': return left != right
  }
}
function __$assign__(object: any, key: PropertyKey, operator: string, value: unknown, postfix: boolean) {
  const old = object[key]
  const res = (object[key] = __$__(old, operator, value))
  return postfix ? old : res
}
function $__(operator: string, value: any): unknown {
  const handler = unaryOperators[operator]
  if (value && value[handler]) return value[handler]()
  switch (operator) {
    case '+': return +value
    case '-': return -value
  }
}
function __$import__(specifier: string): never {
  throw new Error(`import is not supported ('${specifier}')`)
}
const OPERATORS: Record<string, unknown> = { __$__, $__, __$assign__, __$import__ }

// ---------------------------------------------------------------------------

/** Handlers user code may declare at top level; returned from the compiled function. */
const HANDLER_NAMES = [
  'onMouseDown', 'onMouseDrag', 'onMouseUp', 'onMouseMove', 'onKeyDown', 'onKeyUp', 'onFrame', 'onResize',
  'mouseDown', 'loop',
] as const
const TOOL_HANDLERS = ['onMouseDown', 'onMouseDrag', 'onMouseUp', 'onMouseMove', 'onKeyDown', 'onKeyUp'] as const
type Handlers = Partial<Record<(typeof HANDLER_NAMES)[number], (event: unknown) => unknown>>

const RETURN_HANDLERS =
  '\nreturn {' + HANDLER_NAMES.map((n) => `${n}: typeof ${n} === "function" ? ${n} : undefined`).join(', ') + '};'

const HIT_OPTIONS = { segments: true, fill: true, stroke: true, tolerance: 10 }

/**
 * API names are parameters of an outer function and the user's code is the
 * body of an inner one, so user code may redeclare any API name with
 * let/const/class. The user's first line shares a line with the inner header.
 */
function makeFunction(names: string[], body: string): (...args: unknown[]) => () => Handlers {
  return new Function(...names, 'return function () {' + body + '\n}') as (...args: unknown[]) => () => Handlers
}

let bodyOffset: number | undefined
/** Lines the engine's `new Function` wrapper puts before the user's first line. */
function getBodyOffset(): number {
  if (bodyOffset === undefined) {
    try {
      makeFunction([], 'throw new Error()')()()
    } catch (e) {
      bodyOffset = (stackLine(e, 0) ?? 1) - 1
    }
  }
  return bodyOffset ?? 0
}

type ScopeRegistry = { _scopes: Record<string, paper.PaperScope> }
const scopeIds = () => Object.keys((paper.PaperScope as unknown as ScopeRegistry)._scopes)
const scopeById = (id: string) => (paper.PaperScope as unknown as ScopeRegistry)._scopes[id]

function fail(e: unknown, line: number | undefined): RunResult {
  const error: OutputLine & { line?: number } = { kind: 'error', text: errorText(e) }
  if (line !== undefined) error.line = line
  return { ok: false, error }
}

/**
 * Runs PaperScript `code` on `scene` after clearing the previous run (drawings,
 * view/tool handlers, TextPoint counter, paper scopes the previous code created).
 * console output goes to `output`; errors are returned, not written to `output`.
 * Errors thrown later by event handlers are written to `output`.
 */
export function run(code: string, opts: RunOptions): RunResult {
  const { scene } = opts
  takeSceneTeardown(scene)?.()
  const scope = scene.paper
  scene.clear()
  scope.activate()

  let active = true
  const output = (l: OutputLine) => {
    if (active) opts.output(l)
  }
  const clearOutput = () => {
    if (active) opts.clearOutput?.()
  }
  const view = scope.view
  const tool = new scope.Tool()
  tool.activate()
  const lineOffset = getBodyOffset()
  const scopesBefore = new Set(scopeIds())
  const userScopes: paper.PaperScope[] = []

  setSceneTeardown(scene, () => {
    active = false
    view.onFrame = null
    view.onResize = null
    offAll(view, 'frame')
    for (const t of scope.tools.slice()) t.remove()
    for (const s of userScopes) {
      if (s.view) {
        s.view.onFrame = null
        offAll(s.view, 'frame')
      }
      s.remove()
    }
  })

  const api = buildApi(scene, output, { tool, clearOutput, extraCanvases: opts.extraCanvases, lineOffset })

  let compiled: string
  try {
    compiled = (scope.PaperScript.compile(code) as { code: string }).code
  } catch (e) {
    return fail(e, (e as { loc?: { line?: number } }).loc?.line)
  }

  let handlers: Handlers
  try {
    const names = [...Object.keys(api), ...Object.keys(OPERATORS)]
    const values = [...Object.values(api), ...Object.values(OPERATORS)]
    const body = 'var module = { exports: {} }; ' + compiled + RETURN_HANDLERS
    handlers = makeFunction(names, body)(...values).call(scope)
  } catch (e) {
    return fail(e, e instanceof SyntaxError ? undefined : stackLine(e, lineOffset))
  } finally {
    for (const id of scopeIds()) if (!scopesBefore.has(id)) userScopes.push(scopeById(id))
    scope.activate()
  }

  const guard = createGuard(scope, output, { lineOffset })
  for (const name of TOOL_HANDLERS) {
    const fn = handlers[name]
    if (fn) tool[name] = guard(fn)
  }
  if (!handlers.onMouseDown && handlers.mouseDown && handlers.mouseDown !== api.mouseDown) {
    // Legacy mouseEvents.js: a click on empty canvas hands a new TextPoint to the user's mouseDown(point).
    const userMouseDown = handlers.mouseDown
    const TextPoint = api.TextPoint as new (p: paper.Point) => unknown
    tool.onMouseDown = guard((event: paper.ToolEvent) => {
      if (scope.project.hitTest(event.point, HIT_OPTIONS)) return
      userMouseDown(new TextPoint(scope.project.activeLayer.globalToLocal(event.point)))
    })
  }

  const frameGuard = createGuard(scope, output, {
    lineOffset,
    onHandlerError: () => (view.onFrame = null), // one error line, not one per frame
  })
  const loop = handlers.loop !== api.loop ? handlers.loop : undefined
  const onFrame = handlers.onFrame ?? (loop && ((event: unknown) => loop(event)))
  if (onFrame) view.onFrame = frameGuard(onFrame)
  if (handlers.onResize) {
    view.onResize = guard(handlers.onResize)
    view.emit('resize', { size: view.size, delta: new scope.Point(0, 0) })
  }
  view.requestUpdate()
  return { ok: true }
}
