import { afterEach, describe, expect, test, vi } from 'vitest'
import paper from 'paper'
import { createScene, type Scene } from './scene'
import { run, type OutputLine } from './runtime'
import { API_NAMES } from './api'
import convexHullEjs from './__fixtures__/legacy/convexHull.ejs?raw'
import legacyConvexHullJs from './__fixtures__/legacy/convexHull.js?raw'
import segmentIntersectionDemo from '../content/algorithms/segmentIntersection/demo.js?raw'
import triangulationDemo from '../content/algorithms/triangulation/demo.js?raw'
import delaunayDemo from '../content/algorithms/delaunay/demo.js?raw'
import voronoiDemo from '../content/algorithms/voronoi/demo.js?raw'
import kdTreeDemo from '../content/algorithms/kdTree/demo.js?raw'

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
      // two consecutive vertices closer than 0.001
      ['triangulate([[0, 0], [100, 0], [100, 0.0005], [0, 100]])', 'triangulate: vertices must be at least 0.001 apart'],
      // v3 almost on v5 (not consecutive): passes the simplicity test, but the sweep breaks down
      [
        'makeMonotone([[82, 2], [3, 37], [20.99999967183551, -38.999999773744904], [-20, -24], [21, -39]])',
        'makeMonotone: the polygon is too degenerate to triangulate (vertices closer than about 0.001 apart)',
      ],
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

describe('delaunay api', () => {
  const errorsOf = (lines: OutputLine[], res: ReturnType<typeof run>) =>
    [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')

  test('a square gives two triangles, five edges and a four-point hull', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = delaunay([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
      var inRange = r.triangles.every(function (t) { return t.every(function (i) { return i >= 0 && i < 4; }); });
      console.log(Object.keys(r).sort().join(','), r.triangles.length, r.edges.length, r.hull.length, inRange);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'edges,hull,triangles 2 5 4 true' }])
  })

  test('accepts the TextPoints of Points.createRandom', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = Points.createRandom(6);
      var r = delaunay(points);
      console.log(r.triangles.length > 0, r.edges.length >= r.triangles.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'true true' }])
  })

  test('accepts [x, y] pairs and paper Points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var a = delaunay([[0, 0], [1, 0], [0, 1]]);
      var b = delaunay([new Point(0, 0), new Point(100, 0), new Point(50, 80), new Point(50, 20)]);
      console.log(a.triangles.length, b.triangles.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 3' }])
  })

  test('duplicate points are rejected', () => {
    const { exec, lines } = setup()
    const res = exec('delaunay([[0, 0], [100, 0], [0, 0]])')
    expect(res.ok).toBe(false)
    expect(errorsOf(lines, res).some((l) => l.text.includes('delaunay: points must be distinct'))).toBe(true)
  })

  test('bad input is rejected with a clear message', () => {
    for (const [code, msg] of [
      ['delaunay([1, 2])', 'delaunay: expected an array of points (item 1 is not a point)'],
      ["delaunay([[0, 0], [1, 0], 'x'])", 'delaunay: expected an array of points (item 3 is not a point)'],
      ['delaunay(5)', 'delaunay: expected an array of points'],
    ]) {
      const { exec, lines } = setup()
      const res = exec(code)
      expect(res.ok).toBe(false)
      expect(errorsOf(lines, res).some((l) => l.text.includes(msg)), code).toBe(true)
    }
  })

  test('circumcircle returns centre and radius, null for collinear points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var c = circumcircle([0, 0], [100, 0], [0, 100]);
      var d = circumcircle(new TextPoint(0, 0), new Point(50, 50), { x: 100, y: 100 });
      console.log(c.center instanceof Point, c.center.x, c.center.y, Math.round(c.radius * 1000), d);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'true 50 50 70711 null' }])
  })

  test('drawTriangulation adds edges and filled triangles to drawables', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var p = [[0, 0], [100, 0], [100, 100], [0, 100]];
      var r = delaunay(p);
      var n = drawables.length;
      drawTriangulation(p, r, 'red');
      var added = drawables.slice(n);
      var fills = added.filter(function (d) { return d.fillColor; });
      var lines = added.filter(function (d) { return !d.fillColor; });
      console.log(fills.length, lines.length, fills[0].fillColor.alpha, lines[0].strokeWidth);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '2 5 0.08 1.5' }])
  })

  test('the demo runs', () => {
    const { exec, lines } = setup()
    expect(exec(delaunayDemo)).toEqual({ ok: true })
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^\d+ triangle\(s\), \d+ edge\(s\)$/)
  })
})

describe('voronoi api', () => {
  const errorsOf = (lines: OutputLine[], res: ReturnType<typeof run>) =>
    [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')

  test('a square gives one vertex and four rays', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = voronoi([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
      var rays = r.edges.filter(function (e) { return e.b === null && e.dir; });
      var v = r.vertices[0];
      console.log(Object.keys(r).sort().join(','), r.vertices.length, r.edges.length, rays.length, r.cells.length, r.lines.length, v.x, v.y);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: 'cells,edges,lines,vertices 1 4 4 4 0 50 50' }])
  })

  test('accepts the TextPoints of Points.createRandom', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = Points.createRandom(8);
      var r = voronoi(points);
      var inRange = r.cells.every(function (c) { return c.site >= 0 && c.site < 8; });
      console.log(r.cells.length, r.vertices.length > 0, inRange);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '8 true true' }])
  })

  test('a triangle given as [x, y] pairs gives one vertex and three rays', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = voronoi([[0, 0], [100, 0], [0, 100]]);
      var rays = r.edges.filter(function (e) { return e.b === null; });
      console.log(r.vertices.length, rays.length, r.edges.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1 3 3' }])
  })

  test('collinear points give parallel bisector lines', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var r = voronoi([[100, 100], [300, 100], [500, 100]]);
      console.log(r.vertices.length, r.edges.length, r.lines.length, r.cells.length);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '0 0 2 3' }])
  })

  test('duplicate points are rejected', () => {
    const { exec, lines } = setup()
    const res = exec('voronoi([[0, 0], [100, 0], [0, 0]])')
    expect(res.ok).toBe(false)
    expect(errorsOf(lines, res).some((l) => l.text.includes('voronoi: points must be distinct'))).toBe(true)
  })

  test('bad input is rejected with a clear message', () => {
    for (const [code, msg] of [
      ['voronoi([1, 2])', 'voronoi: expected an array of points (item 1 is not a point)'],
      ["voronoi([[0, 0], [1, 0], 'x'])", 'voronoi: expected an array of points (item 3 is not a point)'],
      ['voronoi(5)', 'voronoi: expected an array of points'],
      ['drawVoronoi([[0, 0], [1, 0]], {})', 'drawVoronoi: expected the result of voronoi(points) for the same points'],
      ['voronoiCells([[0, 0], [1, 0]], 3)', 'voronoiCells: expected the result of voronoi(points) for the same points'],
    ]) {
      const { exec, lines } = setup()
      const res = exec(code)
      expect(res.ok).toBe(false)
      expect(errorsOf(lines, res).some((l) => l.text.includes(msg)), code).toBe(true)
    }
  })

  test('voronoiCells gives one polygon per site, inside the box', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = Points.createRandom(10);
      var r = voronoi(points);
      var cells = voronoiCells(points, r);
      var inside = cells.every(function (c) {
        return c.length >= 3 && c.every(function (p) { return p.x >= -1e-6 && p.x <= 775 + 1e-6 && p.y >= -1e-6 && p.y <= 360 + 1e-6; });
      });
      var small = voronoiCells([[10, 10], [30, 10], [10, 30]], voronoi([[10, 10], [30, 10], [10, 30]]), { x0: 0, y0: 0, x1: 40, y1: 40 });
      var smallInside = small.every(function (c) { return c.every(function (p) { return p.x <= 40 + 1e-6 && p.y <= 40 + 1e-6; }); });
      console.log(cells.length, inside, small.length, smallInside);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '10 true 3 true' }])
  })

  test('drawVoronoi adds 1.5px unfilled edges inside the box to drawables', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var p = [[300, 100], [400, 100], [400, 200], [300, 200]];
      var r = voronoi(p);
      var n = drawables.length;
      drawVoronoi(p, r, 'red');
      var added = drawables.slice(n);
      var ok = added.every(function (d) {
        var b = d.bounds;
        return !d.fillColor && d.strokeWidth === 1.5 && b.left >= -1e-6 && b.right <= 775 + 1e-6 && b.top >= -1e-6 && b.bottom <= 360 + 1e-6;
      });
      var m = drawables.length;
      drawVoronoi([[100, 100], [300, 100], [500, 100]], voronoi([[100, 100], [300, 100], [500, 100]]));
      console.log(added.length, ok, drawables.length - m);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '4 true 2' }])
  })

  test('the demo runs', () => {
    const { exec, lines } = setup()
    expect(exec(voronoiDemo)).toEqual({ ok: true })
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^\d+ vertex\/vertices, \d+ edge\(s\), \d+ cell\(s\)$/)
  })
})

describe('kd-tree api', () => {
  const errorsOf = (lines: OutputLine[], res: ReturnType<typeof run>) =>
    [...lines, ...(res.ok ? [] : [res.error])].filter((l) => l.kind === 'error')

  test('four points give a read-only tree of size 4', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var t = kdTree([{ x: 10, y: 10 }, { x: 40, y: 30 }, [20, 50], [60, 20]]);
      var leaves = [];
      function walk(v) { if ('point' in v) leaves.push(v.point); else { walk(v.left); walk(v.right); } }
      walk(t.root);
      console.log(Object.keys(t).sort().join(','), t.size, t.depth, t.root.axis, t.root.value, t.root.left.axis, leaves.join(','),
        Object.isFrozen(t), Object.isFrozen(t.root), Object.isFrozen(t.root.left.left));
    `)
    expect(res).toEqual({ ok: true })
    // root splits at x = 20 (v1, v3 left of or on it), both children split on y
    expect(lines).toEqual([{ kind: 'log', text: 'depth,root,size 4 2 x 20 y 0,2,3,1 true true true' }])
  })

  test('rangeQuery gives the brute-force answer on random point sets', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var bad = 0;
      for (var trial = 0; trial < 20; trial++) {
        var n = 1 + trial;
        var points = Points.createRandom(n);
        var tree = kdTree(points);
        var a = { x: getRandomInt(0, 775), y: getRandomInt(0, 360) };
        var b = { x: getRandomInt(0, 775), y: getRandomInt(0, 360) };
        // corners in any order: rangeQuery normalizes the rectangle
        var r = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
        var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
        var expected = [];
        points.forEach(function (p, i) { if (p.pos.x >= x0 && p.pos.x <= x1 && p.pos.y >= y0 && p.pos.y <= y1) expected.push(i); });
        if (rangeQuery(points, tree, r).join(',') !== expected.join(',')) bad++;
      }
      console.log(bad);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '0' }])
  })

  test('the rectangle can be given by two points', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = [[100, 100], [250, 150], [300, 250], [450, 120], [600, 300], [220, 330]];
      var tree = kdTree(points);
      var a = rangeQuery(points, tree, { x0: 200, y0: 100, x1: 500, y1: 300 });
      var b = rangeQuery(points, tree, [[500, 300], [200, 100]]);
      var c = rangeQuery(points, tree, [new Point(200, 300), { x: 500, y: 100 }]);
      console.log(a.join(','), b.join(','), c.join(','));
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '1,2,3 1,2,3 1,2,3' }])
  })

  test('points on the boundary and coincident points are reported', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = [[100, 100], [100, 100], [100, 200], [200, 100], [300, 300], [100, 150]];
      var tree = kdTree(points);
      console.log(tree.size, rangeQuery(points, tree, { x0: 100, y0: 100, x1: 200, y1: 150 }).join(','),
        rangeQuery(points, tree, { x0: 100, y0: 100, x1: 100, y1: 100 }).join(','));
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '6 0,1,3,5 0,1' }])
  })

  test('bad input is rejected with a clear message', () => {
    const p = '[[0, 0], [10, 0], [0, 10]]'
    for (const [code, msg] of [
      ["kdTree([[0, 0], 'x'])", 'kdTree: expected an array of points (item 2 is not a point)'],
      ['kdTree(5)', 'kdTree: expected an array of points'],
      [`rangeQuery(${p}, kdTree(${p}), 5)`, 'rangeQuery: expected a rectangle {x0, y0, x1, y1} or two points'],
      [`rangeQuery(${p}, kdTree(${p}), { x0: 0, y0: 0, x1: 'a', y1: 1 })`, 'rangeQuery: expected a rectangle {x0, y0, x1, y1} or two points'],
      [`rangeQuery(${p}, kdTree(${p}), [[0, 0]])`, 'rangeQuery: expected a rectangle {x0, y0, x1, y1} or two points'],
      [`rangeQuery(${p}, kdTree([[0, 0], [10, 0]]), [[0, 0], [5, 5]])`, 'rangeQuery: expected the result of kdTree(points) for the same points'],
      // same size, but the points do not lie on the sides of the tree's split lines
      [`rangeQuery(${p}, kdTree([[10, 0], [0, 0], [0, 10]]), [[0, 0], [5, 5]])`, 'rangeQuery: expected the result of kdTree(points) for the same points'],
      [`rangeQuery(${p}, {}, [[0, 0], [5, 5]])`, 'rangeQuery: expected the result of kdTree(points) for the same points'],
      [`rangeQuery([[0, 0], 3], kdTree(${p}), [[0, 0], [5, 5]])`, 'rangeQuery: expected an array of points (item 2 is not a point)'],
      [`drawKdTree(${p}, {})`, 'drawKdTree: expected the result of kdTree(points) for the same points'],
      [`drawKdTree(${p}, kdTree([[0, 0]]))`, 'drawKdTree: expected the result of kdTree(points) for the same points'],
    ]) {
      const { exec, lines } = setup()
      const res = exec(code)
      expect(res.ok, code).toBe(false)
      expect(errorsOf(lines, res).some((l) => l.text.includes(msg)), code).toBe(true)
    }
  })

  test('drawKdTree draws one split line per internal node, inside the padded bounding box', () => {
    const { exec, lines } = setup()
    const res = exec(`
      var points = Points.createRandom(10);
      var tree = kdTree(points);
      var n = drawables.length;
      drawKdTree(points, tree, 'red');
      var added = drawables.slice(n);
      var xs = points.map(function (p) { return p.pos.x; }), ys = points.map(function (p) { return p.pos.y; });
      var x0 = Math.min.apply(null, xs) - 10, x1 = Math.max.apply(null, xs) + 10;
      var y0 = Math.min.apply(null, ys) - 10, y1 = Math.max.apply(null, ys) + 10;
      var ok = added.every(function (d) {
        var b = d.bounds;
        return d.strokeColor.equals(new Color('red')) && (b.width < 1e-6 || b.height < 1e-6) &&
          b.left >= x0 - 1e-6 && b.right <= x1 + 1e-6 && b.top >= y0 - 1e-6 && b.bottom <= y1 + 1e-6;
      });
      var m = drawables.length;
      drawKdTree([[0, 0]], kdTree([[0, 0]]));
      console.log(added.length, ok, drawables.length - m);
    `)
    expect(res).toEqual({ ok: true })
    expect(lines).toEqual([{ kind: 'log', text: '9 true 0' }])
  })

  test('drawKdTree clips every split line to its region, not to the whole box', () => {
    const { exec, lines } = setup()
    // the 10 points of the player's Textbook example; the root region is their bounding box + 10
    const res = exec(`
      var points = [[60, 280], [110, 90], [150, 200], [200, 320], [240, 60],
        [280, 170], [330, 260], [370, 110], [410, 300], [430, 40]];
      var n = drawables.length;
      drawKdTree(points, kdTree(points));
      var added = drawables.slice(n);
      var W = (430 + 10) - (60 - 10), H = (320 + 10) - (40 - 10);
      var vertical = added.filter(function (d) { return d.bounds.width < 1e-6; });
      var horizontal = added.filter(function (d) { return d.bounds.height < 1e-6; });
      console.log(added.length, vertical.length, horizontal.length,
        vertical.filter(function (d) { return d.bounds.height < H - 1e-6; }).length > 0,
        horizontal.filter(function (d) { return d.bounds.width < W - 1e-6; }).length > 0,
        vertical.some(function (d) { return Math.abs(d.bounds.height - H) < 1e-6; }));
    `)
    expect(res).toEqual({ ok: true })
    // 9 split lines; the root's vertical line spans the box, deeper ones are shorter in their own direction
    expect(lines).toEqual([{ kind: 'log', text: '9 5 4 true true true' }])
  })

  test('the demo runs', () => {
    const { exec, lines } = setup()
    expect(exec(kdTreeDemo)).toEqual({ ok: true })
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toMatch(/^\d+ point\(s\) in the range$/)
  })
})
