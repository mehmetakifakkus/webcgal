const KEY = 'webcgal:chunk-reload-at'
/** At most one automatic reload in this many milliseconds. */
export const RELOAD_WINDOW_MS = 10_000

/**
 * Wraps a dynamic import. After a redeploy the chunks of an open page no longer exist; a failed
 * import reloads the page to get the new build, at most once per RELOAD_WINDOW_MS (timestamp in
 * sessionStorage, never cleared on success, so a chunk that keeps failing cannot loop). A second
 * failure within the window, no sessionStorage, or a dev server rethrows the error so the error
 * boundary shows it.
 */
export function reloadOnChunkError<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((e: unknown) => {
    if (import.meta.env.DEV) throw e
    try {
      const last = Number(sessionStorage.getItem(KEY))
      if (last && Date.now() - last < RELOAD_WINDOW_MS) throw e
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch {
      throw e
    }
    console.warn('Loading a module failed; reloading the page to get the current build.', e)
    location.reload()
    return new Promise<T>(() => {}) // the page is reloading
  })
}
