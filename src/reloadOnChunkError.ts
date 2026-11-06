const FLAG = 'webcgal:chunk-reload'

/**
 * Wraps a dynamic import. After a redeploy the chunks of an open page no longer exist; the first
 * failed import reloads the page once to get the new build. A sessionStorage flag prevents loops:
 * a second failure (or no storage) rethrows so the error boundary shows it.
 */
export function reloadOnChunkError<T>(load: () => Promise<T>): Promise<T> {
  return load().then(
    (m) => {
      try {
        sessionStorage.removeItem(FLAG)
      } catch {
        /* storage unavailable */
      }
      return m
    },
    (e: unknown) => {
      try {
        if (sessionStorage.getItem(FLAG) !== null) throw e
        sessionStorage.setItem(FLAG, '1')
      } catch {
        throw e
      }
      location.reload()
      return new Promise<T>(() => {}) // the page is reloading
    },
  )
}
