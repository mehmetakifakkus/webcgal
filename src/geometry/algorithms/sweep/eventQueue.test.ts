import { describe, expect, it } from 'vitest'
import { EventQueue } from './eventQueue'

describe('EventQueue', () => {
  it('orders by y desc then x asc', () => {
    const q = new EventQueue()
    q.insert({ x: 3, y: 5 })
    q.insert({ x: 0, y: 2 })
    q.insert({ x: 1, y: 5 })
    expect(q.popNext()?.p).toEqual({ x: 1, y: 5 })
    expect(q.popNext()?.p).toEqual({ x: 3, y: 5 })
    expect(q.popNext()?.p).toEqual({ x: 0, y: 2 })
    expect(q.popNext()).toBeUndefined()
  })

  it('merges same point', () => {
    const q = new EventQueue()
    q.insert({ x: 1, y: 1 }, 0)
    q.insert({ x: 1, y: 1 }, 2)
    q.insert({ x: 1, y: 1 }, 2)
    q.insert({ x: 1, y: 1 })
    expect(q.size).toBe(1)
    expect(q.popNext()?.upper).toEqual([0, 2])
  })

  it('has works within tolerance', () => {
    const q = new EventQueue()
    q.insert({ x: 1, y: 1 })
    expect(q.has({ x: 1 + 1e-9, y: 1 - 1e-9 })).toBe(true)
    expect(q.has({ x: 1.001, y: 1 })).toBe(false)
  })

  it('toArray is sorted and a copy unaffected by pop', () => {
    const q = new EventQueue()
    q.insert({ x: 0, y: 2 }, 1)
    q.insert({ x: 1, y: 5 }, 0)
    const snap = q.toArray()
    expect(snap.map((e) => e.p.y)).toEqual([5, 2])
    q.popNext()
    expect(snap).toHaveLength(2)
    expect(q.size).toBe(1)
    snap[0].upper.push(9)
    expect(q.toArray()[0].upper).toEqual([1])
  })
})
