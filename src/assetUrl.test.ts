import { describe, expect, it } from 'vitest'
import { assetUrl, routerBasename } from './assetUrl'

describe('assetUrl', () => {
  it('keeps root-served paths unchanged', () => {
    expect(assetUrl('/images/a.png', '/')).toBe('/images/a.png')
  })
  it('prefixes the base path with or without a trailing slash', () => {
    expect(assetUrl('/images/a.png', '/webcgal/')).toBe('/webcgal/images/a.png')
    expect(assetUrl('/images/a.png', '/webcgal')).toBe('/webcgal/images/a.png')
    expect(assetUrl('images/a.png', '/webcgal/')).toBe('/webcgal/images/a.png')
  })
  it('uses the build base by default', () => {
    expect(assetUrl('/images/a.png')).toBe(assetUrl('/images/a.png', import.meta.env.BASE_URL))
  })
})

describe('routerBasename', () => {
  it('is undefined at the root and the base without its trailing slash otherwise', () => {
    expect(routerBasename('/')).toBeUndefined()
    expect(routerBasename('/webcgal/')).toBe('/webcgal')
    expect(routerBasename('/webcgal')).toBe('/webcgal')
  })
})
