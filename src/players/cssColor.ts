/** Reads a CSS custom property at render time (so theme changes apply), falling back when unset. */
export const cssColor = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
