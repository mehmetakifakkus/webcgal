/** One line of the output panel. */
export type OutputLine = { kind: 'log' | 'warn' | 'error'; text: string }

const hasCustomToString = (x: object) =>
  typeof (x as { toString?: unknown }).toString === 'function' && x.toString !== Object.prototype.toString

/** Stringifies a value roughly the way the browser console shows it. */
export function formatValue(x: unknown, nested = false): string {
  if (typeof x === 'string') return nested ? `'${x}'` : x
  if (x === null) return 'null'
  if (typeof x === 'function') return `ƒ ${x.name || 'anonymous'}()`
  if (typeof x !== 'object') return String(x)
  if (Array.isArray(x)) return nested ? `Array(${x.length})` : `[${x.map((v) => formatValue(v, true)).join(', ')}]`
  if (x instanceof Error) return `${x.name}: ${x.message}`
  if (hasCustomToString(x)) return String(x)
  try {
    return JSON.stringify(x) ?? String(x)
  } catch {
    return String(x)
  }
}

export const formatArgs = (args: unknown[]) => args.map((a) => formatValue(a)).join(' ')

/** A `console` replacement for user code that writes to the output panel. */
export function createConsole(output: (l: OutputLine) => void, clearOutput: () => void) {
  const log = (...args: unknown[]) => output({ kind: 'log', text: formatArgs(args) })
  return {
    log,
    info: log,
    debug: log,
    dir: log,
    table: log,
    trace: log,
    warn: (...args: unknown[]) => output({ kind: 'warn', text: formatArgs(args) }),
    error: (...args: unknown[]) => output({ kind: 'error', text: formatArgs(args) }),
    assert: (cond: unknown, ...args: unknown[]) => {
      if (!cond) output({ kind: 'error', text: `Assertion failed${args.length ? ': ' + formatArgs(args) : ''}` })
    },
    clear: clearOutput,
    group: () => {},
    groupEnd: () => {},
  }
}

/**
 * Line (1-based, in the user's code) of the innermost user frame of a runtime
 * error thrown from code built with `new Function`. `bodyOffset` is the number
 * of lines the engine puts before the user's first line.
 */
export function stackLine(e: unknown, bodyOffset: number): number | undefined {
  const stack = e instanceof Error && typeof e.stack === 'string' ? e.stack : ''
  const m = /<anonymous>:(\d+):\d+/.exec(stack) ?? /> Function:(\d+):\d+/.exec(stack)
  if (!m) return undefined
  const line = Number(m[1]) - bodyOffset
  return line >= 1 ? line : undefined
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message.replace(/ \(\d+:\d+\)$/, '')}`
  return `Uncaught ${formatValue(e)}`
}
