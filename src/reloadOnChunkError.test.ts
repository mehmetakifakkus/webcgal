import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RELOAD_WINDOW_MS, reloadOnChunkError } from './reloadOnChunkError'

let store: Map<string, string>
const reload = vi.fn()
let now = 1_000_000

beforeEach(() => {
  store = new Map()
  reload.mockReset()
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubEnv('DEV', false)
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('location', { reload })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const settled = () => new Promise((r) => setTimeout(r, 0))
const stale = new TypeError('Failed to fetch dynamically imported module')
const failing = () => Promise.reject(stale)

test('passes a successful import through', async () => {
  await expect(reloadOnChunkError(() => Promise.resolve(42))).resolves.toBe(42)
  expect(reload).not.toHaveBeenCalled()
})

test('a failed import warns and reloads the page once', async () => {
  let outcome = 'pending'
  reloadOnChunkError(failing).then(
    () => (outcome = 'resolved'),
    () => (outcome = 'rejected'),
  )
  await settled()
  expect(reload).toHaveBeenCalledTimes(1)
  expect(console.warn).toHaveBeenCalledWith(expect.any(String), stale)
  expect(outcome).toBe('pending') // the page is going away
})

test('route import succeeds, then a nested loader fails twice: one reload, then the error surfaces', async () => {
  // first page load: the route chunk loads, its content chunk fails
  await reloadOnChunkError(() => Promise.resolve('route'))
  void reloadOnChunkError(failing)
  await settled()
  expect(reload).toHaveBeenCalledTimes(1)

  // after the reload (2 s later): the route chunk loads again, the content chunk still fails
  now += 2_000
  await expect(reloadOnChunkError(() => Promise.resolve('route'))).resolves.toBe('route')
  await expect(reloadOnChunkError(failing)).rejects.toBe(stale)
  expect(reload).toHaveBeenCalledTimes(1)
})

test('after the window a new failure may reload again', async () => {
  void reloadOnChunkError(failing)
  await settled()
  now += RELOAD_WINDOW_MS + 1
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
  await expect(reloadOnChunkError(failing)).rejects.toBe(stale)
  expect(reload).not.toHaveBeenCalled()
})

test('in development the error is rethrown at once', async () => {
  vi.stubEnv('DEV', true)
  await expect(reloadOnChunkError(failing)).rejects.toBe(stale)
  expect(reload).not.toHaveBeenCalled()
})
