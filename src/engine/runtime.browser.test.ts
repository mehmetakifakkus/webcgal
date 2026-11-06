import { afterEach, describe, expect, test, vi } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from './scene'
import { run, type OutputLine } from './runtime'
import { API_NAMES } from './api'
import convexHullEjs from './__fixtures__/legacy/convexHull.ejs?raw'
import legacyConvexHullJs from './__fixtures__/legacy/convexHull.js?raw'
import segmentIntersectionDemo from '../content/algorithms/segmentIntersection/demo.js?raw'
import triangulationDemo from '../content/algorithms/triangulation/demo.js?raw'

const samples = import.meta.glob('./__fixtures__/legacy/sampleCodes/*.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const scenes: Scene[] = []

/** A fresh 775x360 canvas + scene; `cssWidth` sets the width of its container (canvas is width: 100%). */
function setup(cssWidth = 775) {
  const wrapper = document.createElement('div')
  wrapper.style.width = cssWidth + 'px'
  document.body.appendChild(wrapper)
  const canvas = document.createElement('canvas')
  canvas.width = 775
  canvas.height = 360
  wrapper.appendChild(canvas)
  const scene = createScene(canvas)
  scenes.push(scene)
  const lines: OutputLine[] = []
  const exec = (code: string) => run(code, { scene, output: (l) => lines.push(l) })
  return { canvas, scene, lines, exec }
}

afterEach(() => {
  for (const s of scenes.splice(0)) s.dispose()
  document.body.innerHTML = ''
})

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
async function frames(n: number) {
  for (let i = 0; i < n; i++) await nextFrame()
}

/** The demo code of a legacy algorithm page: everything after `//end-script`, minus EJS includes. */
function legacyDemo(ejs: string, includes: Record<string, string> = {}) {
  const script = ejs.slice(ejs.indexOf('//end-script'), ejs.indexOf('</script>', ejs.indexOf('//end-script')))
  return script.replace(/<%\s*include\s+(\S+)\s*%>/g, (_, file: string) => includes[file] ?? '')
}

test('operators work', () => {
  const { exec, lines } = setup()
  const res = exec('var p = new Point(1,2) + new Point(3,4); console.log(p.x)')
  expect(res).toEqual({ ok: true })
  expect(lines).toEqual([{ kind: 'log', text: '4' }])
})

test('legacy convex hull demo', () => {
  const { exec, scene } = setup()
  const code = legacyDemo(convexHullEjs)
  expect(code).toContain('Points.createRandom(7)')
  expect(exec(code)).toEqual({ ok: true })
  expect(scene.paper.project.activeLayer.children.length).toBeGreaterThan(7)
})

test('legacy convex hull demo with the legacy convexHull.js (Array.prototype.delete, isLeftTurn)', () => {
  const { exec, scene } = setup()
  const code = legacyDemo(convexHullEjs, { '../partials/paperjs/convexHull.js': legacyConvexHullJs })
  expect(code).toContain('Lupper.delete(-2)')
  expect(exec(code)).toEqual({ ok: true })
  const lines = scene.paper.project.activeLayer.children.filter((c) => c.className === 'Path' && (c as paper.Path).segments.length === 2)
  expect(lines.length).toBeGreaterThanOrEqual(3)
})

test('convexHull returns a closed TextPoint list', () => {
  const { exec, lines } = setup()
  const res = exec(`
    var pts = [new TextPoint(0,0), new TextPoint(100,0), new TextPoint(50,50), new TextPoint(100,100), new TextPoint(0,100)];
    var h = convexHull(pts);
    console.log(h.length, h[0] === h[h.length-1], h[0] instanceof TextPoint, h.indexOf(pts[2]));
  `)
  expect(res).toEqual({ ok: true })
  expect(lines).toEqual([{ kind: 'log', text: '5 true true -1' }])
})

test('legacy sample codes run', () => {
  const files = Object.keys(samples).sort()
  expect(files.map((f) => f.split('/').pop())).toEqual([
    'code1.js',
    'code2.js',
    'code3.js',
    'codeConvexHull.js',
    'playground1.js',
  ])
  let sections = 0
  for (const file of files) {
    let src = samples[file]
    // Ruling: the only allowed sample edit (polygon.points is an array).
    if (file.endsWith('code3.js')) src = src.replaceAll('polygon.points.p0', 'polygon.points[0]')
    for (const section of src.split(/^-{3,}[ \t]*$/m)) {
      if (!section.trim()) continue
      sections++
      const { exec } = setup()
      expect([file, exec(section)]).toEqual([file, { ok: true }])
    }
  }
  expect(sections).toBe(7)
})

test('runtime error is reported', () => {
  const { exec } = setup()
  const res = exec('foo.bar()')
  expect(res.ok).toBe(false)
  if (res.ok) return
  expect(res.error.kind).toBe('error')
  expect(res.error.text).toContain('foo')
  expect(res.error.line).toBe(1)
})

test('runtime error line points into the user code', () => {
  const { exec } = setup()
  const res = exec('var a = 1;\nvar b = a + new Point(1, 1);\n\nfunction f() { return undefinedThing.x }\nf()')
  expect(res.ok).toBe(false)
  if (!res.ok) expect(res.error.line).toBe(4)
})

test('syntax error is reported', () => {
  const { exec } = setup()
  const res = exec('var a = 1;\nvar = ;')
  expect(res.ok).toBe(false)
  if (res.ok) return
  expect(res.error.kind).toBe('error')
  expect(res.error.line).toBe(2)
})

test('run twice replaces handlers', async () => {
  const { exec } = setup()
  const w = window as unknown as { __frames: number }
  w.__frames = 0
  expect(exec('function onFrame(event) { window.__frames++ }')).toEqual({ ok: true })
  await frames(3)
  expect(w.__frames).toBeGreaterThan(0)
  expect(exec('var x = 1;')).toEqual({ ok: true })
  const after = w.__frames
  await frames(3)
  expect(w.__frames).toBe(after)
})

test('user mouse handlers are wired to a tool and replaced on the next run', () => {
  const { exec, scene, lines } = setup()
  exec('function onMouseDown(event) { console.log("down " + Math.round(event.point.x)) }')
  scene.paper.tool.emit('mousedown', { point: new scene.paper.Point(5, 5) })
  expect(lines).toEqual([{ kind: 'log', text: 'down 5' }])
  exec('var y = 2;')
  expect(scene.paper.tools.length).toBe(1)
  scene.paper.tool.emit('mousedown', { point: new scene.paper.Point(5, 5) })
  expect(lines).toHaveLength(1)
})

const VIEW_EVENTS = [
  'mousedown', 'mouseup', 'mousemove', 'mousedrag', 'click', 'doubleclick', 'mouseenter', 'mouseleave', 'keydown',
  'keyup', 'resize',
]

test('view handlers set by user code do not survive the next run', () => {
  const { exec, scene } = setup()
  const w = window as unknown as { __viewEvents: string[] }
  w.__viewEvents = []
  exec(`
    view.onMouseDown = function () { window.__viewEvents.push('prop:mousedown') };
    view.onClick = function () { window.__viewEvents.push('prop:click') };
    view.onMouseMove = function () { window.__viewEvents.push('prop:mousemove') };
    view.onResize = function () { window.__viewEvents.push('prop:resize') };
    ${JSON.stringify(VIEW_EVENTS)}.forEach(function (type) {
      view.on(type, function () { window.__viewEvents.push('on:' + type) })
    });
  `)
  const view = scene.paper.view as unknown as { emit(type: string, event: unknown): void }
  const emitAll = () => VIEW_EVENTS.forEach((type) => view.emit(type, { point: new scene.paper.Point(5, 5) }))
  emitAll()
  expect(w.__viewEvents).toContain('prop:mousedown')
  expect(w.__viewEvents).toContain('prop:click')
  expect(w.__viewEvents).toContain('on:click')
  expect(w.__viewEvents).toContain('on:keyup')

  w.__viewEvents = []
  expect(exec('var nothing = 1;')).toEqual({ ok: true })
  emitAll()
  expect(w.__viewEvents).toEqual([])
  expect(scene.paper.view.onMouseDown).toBeNull()
  expect(scene.paper.view.onClick).toBeNull()
})

test('handler errors go to output', () => {
  const { exec, scene, lines } = setup()
  exec('function onMouseUp(event) { nope() }')
  scene.paper.tool.emit('mouseup', { point: new scene.paper.Point(1, 1) })
  expect(lines).toHaveLength(1)
  expect(lines[0].kind).toBe('error')
  expect(lines[0].text).toContain('nope')
})

test('console warn/error/info and print helpers', () => {
  const { exec, lines } = setup()
  exec('console.warn("w"); console.error("e"); console.info("i", 2); print(new Point(1,2)); printLog([1, "a"]); console.log({a: 1}, null, undefined)')
  expect(lines).toEqual([
    { kind: 'warn', text: 'w' },
    { kind: 'error', text: 'e' },
    { kind: 'log', text: 'i 2' },
    { kind: 'log', text: '{ x: 1, y: 2 }' },
    { kind: 'log', text: "[1, 'a']" },
    { kind: 'log', text: '{"a":1} null undefined' },
  ])
})

test('createPolygon unknown name', () => {
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
  const { exec, lines } = setup()
  expect(exec("var p = createPolygon('nope'); console.log(typeof p)")).toEqual({ ok: true })
  expect(alert).not.toHaveBeenCalled()
  expect(lines.some((l) => l.kind === 'error' && l.text.includes('nope'))).toBe(true)
  expect(lines[lines.length - 1]).toEqual({ kind: 'log', text: 'undefined' })
  alert.mockRestore()
})

test('createPolygon places the predefined polygon', () => {
  const { exec, lines } = setup()
  exec("var p = createPolygon('square'); console.log(p.points.length, p.points[0].pos.x, p.points[0].pos.y)")
  // 250x250 square centred at the default position [250, 180]
  expect(lines).toEqual([{ kind: 'log', text: '4 125 55' }])
})

test('y axis is flipped', () => {
  const { exec, scene } = setup()
  expect(exec('new TextPoint(10, 10)')).toEqual({ ok: true })
  const layer = scene.paper.project.activeLayer
  const path = layer.children['_p0' as unknown as number]
  expect(path).toBeTruthy()
  expect(path.bounds.center.y).toBeCloseTo(10)
  const viewPoint = scene.paper.view.projectToView(layer.localToGlobal(path.bounds.center))
  expect(viewPoint.y).toBeCloseTo(scene.height - 10)
  expect(scene.height).toBe(360)
})

test('TextPoint counter restarts on every run', () => {
  const { exec, lines } = setup()
  exec('console.log(new TextPoint(1, 1).id)')
  exec('console.log(new TextPoint(1, 1).id, String(new TextPoint(2, 3)))')
  expect(lines).toEqual([
    { kind: 'log', text: '0' },
    { kind: 'log', text: '0 _p1 { x: 2, y: 3 }' },
  ])
})

test('two scenes coexist', () => {
  const a = setup()
  const b = setup()
  a.exec('new TextPoint(1, 1); new TextPoint(2, 2)')
  b.exec('new TextPoint(1, 1)')
  expect(a.scene.paper.project.activeLayer.children.length).toBe(4)
  expect(b.scene.paper.project.activeLayer.children.length).toBe(2)
  expect(a.scene.paper).not.toBe(b.scene.paper)
})

test('the injected paper is the paper module and user scopes are released on re-run', async () => {
  const { exec } = setup()
  const extra = document.createElement('canvas')
  extra.id = 'canvas-2'
  document.body.appendChild(extra)
  const w = window as unknown as { __extraFrames: number }
  w.__extraFrames = 0
  const res = exec(`
    var s = new paper.PaperScope();
    s.setup(document.getElementById('canvas-2'));
    s.view.onFrame = function () { window.__extraFrames++ };
  `)
  expect(res).toEqual({ ok: true })
  await frames(3)
  expect(w.__extraFrames).toBeGreaterThan(0)
  exec('')
  const after = w.__extraFrames
  await frames(3)
  expect(w.__extraFrames).toBe(after)
})

test('Array.prototype patches are not enumerable', () => {
  const keys: string[] = []
  for (const k in [1, 2]) keys.push(k)
  expect(keys).toEqual(['0', '1'])
  expect(typeof ([] as unknown as { delete: unknown }).delete).toBe('function')
})

test('dispose stops handlers', async () => {
  const { exec, scene } = setup()
  const w = window as unknown as { __frames: number }
  w.__frames = 0
  exec('function onFrame() { window.__frames++ }')
  await frames(2)
  scene.dispose()
  const after = w.__frames
  await frames(3)
  expect(w.__frames).toBe(after)
})

/** Mouse gesture in inner (view) coordinates, mapped through the canvas' CSS size. */
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  const r = canvas.getBoundingClientRect()
  const sx = r.width / 775
  const sy = r.height / 360
  const at = ([x, y]: [number, number]) => ({ clientX: r.left + x * sx, clientY: r.top + y * sy, bubbles: true })
  canvas.dispatchEvent(new MouseEvent('mousedown', at(from)))
  document.dispatchEvent(new MouseEvent('mousemove', at([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2])))
  document.dispatchEvent(new MouseEvent('mousemove', at(to)))
  document.dispatchEvent(new MouseEvent('mouseup', at(to)))
}

for (const width of [775, 375]) {
  test(`dragging a TextPoint moves it (canvas ${width}px wide)`, () => {
    const { exec, canvas, lines } = setup(width)
    expect(canvas.getBoundingClientRect().width).toBeCloseTo(width)
    exec('var p = new TextPoint(100, 100); window.__p = p')
    // (100, 100) with y up is (100, 260) in view coordinates; drag 20 right and 30 up.
    drag(canvas, [100, 260], [120, 230])
    const p = (window as unknown as { __p: { pos: paper.Point } }).__p
    // client coordinates are whole CSS pixels, so a scaled canvas is off by up to ~2 inner pixels
    const tolerance = width === 775 ? 0.01 : 2.5
    expect(Math.abs(p.pos.x - 120)).toBeLessThan(tolerance)
    expect(Math.abs(p.pos.y - 130)).toBeLessThan(tolerance)
    expect(lines).toEqual([])
  })
}

test('dragging a polygon outline moves all corners', () => {
  const { exec, canvas } = setup()
  exec("var poly = createPolygon('square'); poly.draw(); window.__poly = poly")
  // the square spans x 125..375, y 55..305 (y up) -> view y 55..305; (250, 180) is inside
  drag(canvas, [250, 180], [260, 170])
  const poly = (window as unknown as { __poly: { points: { pos: paper.Point }[]; path: paper.Path } }).__poly
  expect(poly.points[0].pos.x).toBeCloseTo(135)
  expect(poly.points[0].pos.y).toBeCloseTo(65)
  expect(poly.path.segments[0].point.x).toBeCloseTo(135)
})

test('a click on empty canvas calls the user mouseDown(point) with a TextPoint', () => {
  const { exec, canvas, lines } = setup()
  exec('function mouseDown(point) { console.log(point instanceof TextPoint, Math.round(point.pos.x), Math.round(point.pos.y)) }')
  drag(canvas, [300, 60], [300, 60])
  expect(lines).toEqual([{ kind: 'log', text: 'true 300 300' }])
})

test('loop(event) is called every frame when defined', async () => {
  const { exec, lines } = setup()
  exec('var n = 0; function loop(event) { if (n++ === 1) console.log("loop", typeof event.count) }')
  await frames(4)
  expect(lines).toEqual([{ kind: 'log', text: 'loop number' }])
})

test('an onFrame error is reported once and stops the animation', async () => {
  const { exec, lines } = setup()
  exec('function onFrame() { missing() }')
  await frames(4)
  expect(lines).toHaveLength(1)
  expect(lines[0].text).toMatch(/missing.*\(line 1\)/)
})

test('extraCanvases are reachable through document.getElementById', () => {
  const { scene, lines } = setup()
  const extra = document.createElement('canvas') // not in the DOM
  ;(window as unknown as { __extra: HTMLCanvasElement }).__extra = extra
  const res = run(
    "var c = document.getElementById('canvas-2'); console.log(c === window.__extra, c !== null, document.getElementById('nope'), typeof document.createElement)",
    { scene, output: (l) => lines.push(l), extraCanvases: { 'canvas-2': extra } },
  )
  expect(res).toEqual({ ok: true })
  expect(lines).toEqual([{ kind: 'log', text: 'true true null function' }])
})

test('let/const may redeclare API names', () => {
  const { exec, lines } = setup()
  expect(exec('const origin = new Point(5, 5); let polygon = 1; class Points {}; console.log(origin.x, polygon)')).toEqual({ ok: true })
  expect(lines).toEqual([{ kind: 'log', text: '5 1' }])
})

test('every API name is defined for user code', () => {
  const { exec, lines } = setup()
  const names = API_NAMES.filter((n) => n !== 'polygon')
  exec(`console.log([${names.map((n) => `typeof ${n} === 'undefined' ? '${n}' : ''`).join(', ')}].filter(Boolean).join(','))`)
  expect(lines).toEqual([{ kind: 'log', text: '' }])
})

type Registry = { _scopes: Record<string, paper.PaperScope> }
const registry = () => (paper.PaperScope as unknown as Registry)._scopes
const scopesOn = (canvas: HTMLCanvasElement) => Object.values(registry()).filter((s) => s.view?.element === canvas)

/** Legacy duality demos set up a fresh scope on a second canvas inside mouse handlers. */
const HANDLER_SCOPE_CODE = `
  function onMouseDown(event) {
    var s = new paper.PaperScope();
    s.setup(document.getElementById('canvas-2'));
    new s.Path.Circle({ center: [10, 10], radius: 5, fillColor: 'red' });
    s.view.onFrame = function () { window.__handlerFrames++ };
    window.__lastScope = s;
  }
`

function handlerScopeSetup() {
  const t = setup()
  const extra = document.createElement('canvas')
  extra.width = 200
  extra.height = 100
  extra.id = 'canvas-2'
  document.body.appendChild(extra)
  const w = window as unknown as { __handlerFrames: number; __lastScope?: paper.PaperScope }
  w.__handlerFrames = 0
  w.__lastScope = undefined
  expect(t.exec(HANDLER_SCOPE_CODE)).toEqual({ ok: true })
  const press = () => t.scene.paper.tool.emit('mousedown', { point: new t.scene.paper.Point(5, 5) })
  return { ...t, extra, w, press }
}

for (const end of ['re-run', 'dispose'] as const) {
  test(`scopes created in handlers are released on ${end}`, async () => {
    const { exec, scene, extra, w, press, lines } = handlerScopeSetup()
    press()
    expect(lines).toEqual([])
    const created = w.__lastScope!
    expect(created).toBeTruthy()
    expect(Object.values(registry())).toContain(created)
    // the handler's scope must not stay active: scene items still go to the scene
    const probe = new paper.Path()
    expect(probe.project).toBe(scene.paper.project)
    probe.remove()
    await frames(3)
    expect(w.__handlerFrames).toBeGreaterThan(0)
    if (end === 're-run') exec('')
    else scene.dispose()
    expect(Object.values(registry())).not.toContain(created)
    expect(scopesOn(extra)).toEqual([])
    const after = w.__handlerFrames
    await frames(3)
    expect(w.__handlerFrames).toBe(after)
  })
}

test('repeated handler scopes on one canvas keep at most one alive, and it still works', async () => {
  const { extra, w, press } = handlerScopeSetup()
  for (let i = 0; i < 5; i++) press()
  expect(scopesOn(extra)).toEqual([w.__lastScope])
  const latest = w.__lastScope!
  expect(latest.project.activeLayer.children.length).toBe(1)
  // the surviving view still gets frames and DOM mouse events
  await frames(3)
  expect(w.__handlerFrames).toBeGreaterThan(0)
  let downs = 0
  latest.view.onMouseDown = () => void downs++
  const r = extra.getBoundingClientRect()
  extra.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 5, clientY: r.top + 5, bubbles: true }))
  document.dispatchEvent(new MouseEvent('mouseup', { clientX: r.left + 5, clientY: r.top + 5, bubbles: true }))
  expect(downs).toBe(1)
})

describe('segments api', () => {
  test('findIntersections returns paper Points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = findIntersections([{ a: new Point(0, 0), b: new Point(100, 100) }, { a: { x: 0, y: 100 }, b: { x: 100, y: 0 } }]);
      var p = r.points[0];
      console.log(r.points.length, r.overlaps.length, p.p instanceof Point, Math.round(p.p.x), Math.round(p.p.y), p.segments.join(','));
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 0 true 50 50 0,1' }])
  })

  test('bruteForceIntersections reports overlaps with paper Points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = bruteForceIntersections([{ a: new Point(0, 0), b: new Point(100, 0) }, { a: new Point(50, 0), b: new Point(150, 0) }]);
      var o = r.overlaps[0];
      console.log(r.overlaps.length, o.a instanceof Point, o.b instanceof Point, o.segments.join(','));
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 true true 0,1' }])
  })

  test('Segments.createRandom makes n segments inside the canvas, at least minLen long', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var s = Segments.createRandom(5);
      var ok = s.every(function (g) {
        var inside = [g.a, g.b].every(function (q) { return q instanceof Point && q.x >= 77.5 && q.x <= 697.5 && q.y >= 36 && q.y <= 324; });
        return inside && g.a.getDistance(g.b) >= 40;
      });
      console.log(s.length, ok);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '5 true' }])
  })

  test('Segments.draw and drawIntersections add to drawables', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var s = [{ a: new Point(0, 0), b: new Point(100, 100) }, { a: new Point(0, 100), b: new Point(100, 0) }];
      Segments.draw(s);
      var n = drawables.length;
      drawIntersections(findIntersections(s));
      console.log(n, drawables.length - n);
      clear();
      console.log(drawables.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([
      { kind: 'log', text: '4 1' },
      { kind: 'log', text: '0' },
    ])
  })

  test('bad segment input is rejected with a clear message', () => {
    for (const [code, fn] of [
      ['findIntersections(5)', 'findIntersections'],
      ['findIntersections([{ b: new Point(1, 1) }])', 'findIntersections'],
      ['bruteForceIntersections([{ a: new Point(0, 0), b: undefined }])', 'bruteForceIntersections'],
      ['findIntersections([[new Point(0, 0)]])', 'findIntersections'],
      ["Segments.draw([{ a: 'x', b: [1, 2] }])", 'Segments.draw'],
    ]) {
      const { exec, lines } = setup()
      const res = exec(code)
      expect(res.ok).toBe(false)
      const errors = [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')
      expect(errors.some((l) => l.text.includes(fn + ': segments must be an array of {a, b}'))).toBe(true)
    }
  })

  test('segments may also be given as [p, q] pairs', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var s = [[new Point(0, 0), new Point(100, 100)], [{ x: 0, y: 100 }, [100, 0]]];
      Segments.draw(s);
      var r = findIntersections(s);
      var b = bruteForceIntersections(s);
      console.log(r.points.length, Math.round(r.points[0].p.x), Math.round(r.points[0].p.y), r.points[0].segments.join(','), b.points.length, drawables.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 50 50 0,1 1 4' }])
  })

  test('the demo runs', () => {
    const { exec, lines } = setup()
    expect(exec(segmentIntersectionDemo)).toEqual({ ok: true })
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^\d+ intersection point\(s\), \d+ overlap\(s\)$/)
  })
})

describe('triangulation api', () => {
  test('triangulate a square given as {x, y} points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = triangulate([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
      console.log(r.triangles.length, r.triangulationDiagonals.length + r.partitionDiagonals.length, r.types.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '2 1 4' }])
  })

  test('triangulate an engine Polygon', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var p = createPolygon('square');
      var r = triangulate(p);
      console.log(r.triangles.length === p.points.length - 2, r.triangles.length > 0);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'true true' }])
  })

  test('accepts TextPoints, paper Points and [x, y] pairs', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var a = triangulate([new TextPoint(0, 0), new TextPoint(100, 0), new TextPoint(50, 80)]);
      var b = triangulate([new Point(0, 0), new Point(100, 0), new Point(100, 100), new Point(0, 100)]);
      var c = triangulate([[0, 0], [100, 0], [100, 100], [50, 150], [0, 100]]);
      console.log(a.triangles.length, b.triangles.length, c.triangles.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 2 3' }])
  })

  test('api accepts clockwise polygon', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var ccw = [[0, 0], [200, 0], [200, 100], [100, 40], [0, 100]];
      var cw = ccw.slice().reverse();
      var a = triangulate(ccw);
      var b = triangulate(cw);
      var inRange = b.triangles.every(function (t) { return t.every(function (i) { return i >= 0 && i < 5; }); });
      console.log(a.triangles.length, b.triangles.length, b.types.length, inRange);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '3 3 5 true' }])
  })

  test('makeMonotone returns types, diagonals and pieces', () => {
    const { exec, lines } = setup()
    const res = exec(`
      // a split vertex at (100, 40): one partition diagonal, two pieces
      var m = makeMonotone([[0, 0], [200, 0], [200, 100], [100, 40], [0, 100]].map(function (q) { return [q[0], 100 - q[1]]; }));
      console.log(Object.keys(m).sort().join(','), m.types.length, m.diagonals.length, m.pieces.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'diagonals,pieces,types 5 1 2' }])
  })

  test('a non-simple polygon is rejected', () => {
    const { exec, lines } = setup()
    const res = exec(`triangulate([[0, 0], [100, 100], [100, 0], [0, 100]])`)
    expect(res.ok).toBe(false)
    const errors = [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')
    expect(errors.some((l) => l.text.includes('triangulate: the polygon must be simple (no crossing edges)'))).toBe(true)
  })

  test('bad input is rejected with a clear message', () => {
    for (const [code, msg] of [
      ['triangulate([1, 2, 3])', 'triangulate: expected a Polygon or an array of points (item 1 is not a point)'],
      ['triangulate(5)', 'triangulate: expected a Polygon or an array of points'],
      ["makeMonotone([[0, 0], [1, 0], 'x'])", 'makeMonotone: expected a Polygon or an array of points (item 3 is not a point)'],
      ['triangulate([[0, 0], [1, 0]])', 'triangulate: the polygon needs at least 3 vertices'],
    ]) {
      const { exec, lines } = setup()
      const res = exec(code)
      expect(res.ok).toBe(false)
      const errors = [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')
      expect(errors.some((l) => l.text.includes(msg)), code).toBe(true)
    }
  })

  test('drawDiagonals and drawTriangles add to drawables', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var p = [[0, 0], [100, 0], [100, 100], [0, 100]];
      var r = triangulate(p);
      var n = drawables.length;
      drawDiagonals(p, r.triangulationDiagonals);
      var d = drawables.length - n;
      drawTriangles(p, r.triangles);
      var last = drawables[drawables.length - 1];
      console.log(d, drawables.length - n - d, last.fillColor.alpha, last.strokeWidth, drawables[n].strokeWidth);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 2 0.12 1 2' }])
  })

  test('the demo runs', () => {
    const { exec, lines } = setup()
    expect(exec(triangulationDemo)).toEqual({ ok: true })
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^\d+ triangle\(s\), \d+ partition diagonal\(s\)$/)
  })
})
