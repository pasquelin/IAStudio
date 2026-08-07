import { describe, expect, it } from 'vitest'
import manifest from '../../package.json'
import { APP_NAME } from './constants'

describe('APP_NAME', () => {
  it('matches the productName electron-builder will read', () => {
    // electron-builder reads JSON and cannot import this module, so the name is unavoidably
    // written twice. Pinning it here turns a silent drift into a failing build.
    expect(manifest.productName).toBe(APP_NAME)
  })
})
