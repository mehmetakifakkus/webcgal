import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { reloadOnChunkError } from './reloadOnChunkError'

let store: Map<string, string>
const reload = vi.fn()

beforeEach(() => {
  store = new Map()
  reload.mockReset()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('location', { reload })
})
afterEach(() => vi.unstubAllGlobals())

const settled = () => new Promise((r) => setTimeout(r, 0))

test('passes a successful import through', async () => {
  await expect(reloadOnChunkError(() => Promise.resolve(42))).resolves.toBe(42)
  expect(reload).not.toHaveBeenCalled()
})

test('a failed import reloads the page once', async () => {
  const failing = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
  let outcome = 'pending'
  reloadOnChunkError(failing).then(
    () => (outcome = 'resolved'),
    () => (outcome = 'rejected'),
  )
  await settled()
  expect(reload).toHaveBeenCalledTimes(1)
  expect(outcome).toBe('pending') // the page is going away

  // after the reload the import fails again: no loop, the error surfaces
  await expect(reloadOnChunkError(failing)).rejects.toThrow('dynamically imported')
  expect(reload).toHaveBeenCalledTimes(1)
})

test('a successful import clears the guard', async () => {
  const failing = () => Promise.reject(new Error('boom'))
  void reloadOnChunkError(failing)
  await settled()
  await reloadOnChunkError(() => Promise.resolve(1))
  void reloadOnChunkError(failing)
  await settled()
  expect(reload).toHaveBeenCalledTimes(2)
})

test('without sessionStorage the error surfaces instead of risking a loop', async () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
    removeItem: () => {},
  })
  await expect(reloadOnChunkError(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  expect(reload).not.toHaveBeenCalled()
})
