import type { Diagonal, Polygon, Segment, VertexType } from '../../types'
import { StatusStructure } from '../sweep/status'
import { interiorToRight, lexicographicOrder, vertexTypes } from './polygon'
import type { TriPatch, TriRecorder, TriRecorderContext } from './triangulationState'

// de Berg et al., Computational Geometry, §3.2: MakeMonotone and the five
// Handle*Vertex procedures. `record` lines index TRIANGULATION_PSEUDOCODE
// (Task 4). Edge e_i runs from v_i to v_{i+1}; e_{i−1} ends at v_i.

const v = (i: number) => `v${i + 1}`
const e = (i: number) => `e${i + 1}`

const HANDLER: Record<VertexType, string> = {
  start: 'HandleStartVertex',
  end: 'HandleEndVertex',
  split: 'HandleSplitVertex',
  merge: 'HandleMergeVertex',
  regular: 'HandleRegularVertex',
}

/**
 * Partitions a simple CCW polygon into y-monotone pieces. Returns the diagonals
 * (as [min, max], in insertion order; no duplicates, never a polygon edge) and
 * the vertex types.
 */
export function makeMonotone(
  polygon: Polygon,
  record?: TriRecorder,
): { diagonals: Diagonal[]; types: VertexType[] } {
  const n = polygon.length
  const types = vertexTypes(polygon)
  const edges: Segment[] = polygon.map((a, i) => ({ a, b: polygon[(i + 1) % n] }))
  const status = new StatusStructure(edges)
  const helpers = new Map<number, number>()
  const diagonals: Diagonal[] = []
  const keys = new Set<string>()
  let queue: number[] = []
  let sweepY: number | null = null

  const ctx = (): TriRecorderContext => ({
    phase: 'partition',
    sweepY,
    queue: [...queue],
    status: status.toArray().map((edge) => ({ edge, helper: helpers.get(edge)! })),
    partitionDiagonals: diagonals.map((d) => [...d] as Diagonal),
    pieces: [],
    stack: [],
    triangulationDiagonals: [],
    types: [...types],
  })
  const rec = (line: number, description: string, patch: TriPatch = {}) =>
    record?.(line, description, patch, ctx())

  const prevEdge = (i: number) => (i - 1 + n) % n

  /** Adds diagonal v_i–v_j unless it is a duplicate or a polygon edge. */
  const addDiagonal = (line: number, i: number, j: number, prefix = '') => {
    const d: Diagonal = i < j ? [i, j] : [j, i]
    const k = d.join(',')
    const isEdge = (d[0] + 1) % n === d[1] || (d[1] + 1) % n === d[0]
    if (keys.has(k) || isEdge || i === j) {
      rec(line, `${prefix}diagonal ${v(i)}–${v(j)} is already present`, { current: i })
      return
    }
    keys.add(k)
    diagonals.push(d)
    rec(line, `${prefix}${prefix ? 'add' : 'Add'} diagonal ${v(i)}–${v(j)}`, { current: i, reported: [...d] as Diagonal })
  }

  /** "if helper(edge) is a merge vertex, insert the diagonal connecting v_i to helper(edge)". */
  const mergeCheck = (line: number, i: number, edge: number) => {
    const h = helpers.get(edge)!
    if (types[h] === 'merge') addDiagonal(line, i, h, `helper(${e(edge)}) = ${v(h)} is a merge vertex → `)
    else rec(line, `helper(${e(edge)}) = ${v(h)} is not a merge vertex`, { current: i })
  }

  const insertEdge = (line: number, i: number) => {
    status.insert(i, polygon[i])
    helpers.set(i, i)
    rec(line, `Insert ${e(i)} into T with helper ${v(i)}`, { current: i })
  }

  const deleteEdge = (line: number, i: number, edge: number) => {
    status.remove(edge)
    helpers.delete(edge)
    rec(line, `Delete ${e(edge)} from T`, { current: i })
  }

  const searchLeft = (line: number, i: number): number => {
    const j = status.leftOf(polygon[i])
    if (j === undefined) throw new Error(`no edge left of ${v(i)}`)
    rec(line, `Edge directly left of ${v(i)}: ${e(j)}`, { current: i, edgeLeft: j })
    return j
  }

  const setHelper = (line: number, i: number, edge: number) => {
    helpers.set(edge, i)
    rec(line, `Set helper(${e(edge)}) = ${v(i)}`, { current: i })
  }

  // MakeMonotone(P)
  queue = lexicographicOrder(polygon)
  rec(1, 'Construct the event queue Q: vertices in lexicographic order')
  rec(2, 'Initialize an empty status structure T')

  while (queue.length > 0) {
    const i = queue.shift()!
    sweepY = polygon[i].y
    const type = types[i]
    rec(4, `Next vertex ${v(i)} (${type})`, { current: i })
    rec(5, `${v(i)} is a${type === 'end' ? 'n' : ''} ${type} vertex → ${HANDLER[type]}`, { current: i })

    switch (type) {
      case 'start':
        insertEdge(7, i)
        break
      case 'end':
        mergeCheck(9, i, prevEdge(i))
        deleteEdge(10, i, prevEdge(i))
        break
      case 'split': {
        const j = searchLeft(12, i)
        addDiagonal(13, i, helpers.get(j)!)
        setHelper(13, i, j)
        insertEdge(14, i)
        break
      }
      case 'merge': {
        mergeCheck(16, i, prevEdge(i))
        deleteEdge(17, i, prevEdge(i))
        const j = searchLeft(18, i)
        mergeCheck(19, i, j)
        setHelper(20, i, j)
        break
      }
      case 'regular':
        if (interiorToRight(polygon, i)) {
          rec(22, `Interior of P lies to the right of ${v(i)}`, { current: i })
          mergeCheck(23, i, prevEdge(i))
          deleteEdge(24, i, prevEdge(i))
          insertEdge(24, i)
        } else {
          rec(22, `Interior of P lies to the left of ${v(i)}`, { current: i })
          const j = searchLeft(26, i)
          mergeCheck(27, i, j)
          setHelper(28, i, j)
        }
        break
    }
  }

  return { diagonals, types }
}
