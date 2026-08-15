import { describe, expect, it } from 'vitest'
import { isMirrorRoute, MIRROR_ROUTE } from './mirror'

describe('the video return route', () => {
  it('is read with or without the fragment mark, as the main process loads it', () => {
    expect(isMirrorRoute(`#${MIRROR_ROUTE}`)).toBe(true)
    expect(isMirrorRoute(MIRROR_ROUTE)).toBe(true)
  })

  it('is not any other window of the studio', () => {
    expect(isMirrorRoute('#settings')).toBe(false)
    expect(isMirrorRoute('')).toBe(false)
  })
})
