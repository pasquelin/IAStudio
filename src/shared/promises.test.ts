import { describe, expect, it } from 'vitest'
import { orElse } from './promises'

describe('orElse', () => {
  it('answers what the promise settled on', async () => {
    await expect(orElse(Promise.resolve('landed'), 'fallback')).resolves.toBe('landed')
  })

  it('answers the fallback where the promise refused', async () => {
    await expect(orElse(Promise.reject(new Error('refused')), 'fallback')).resolves.toBe('fallback')
  })

  it('answers the fallback where there was no promise at all', async () => {
    await expect(orElse(undefined, 'fallback')).resolves.toBe('fallback')
  })

  // The value a caller means to keep is often falsy — `null` from a catalogue that holds nothing,
  // `0` from a count. Answering the fallback for those would be a different function.
  it('keeps a falsy value the promise settled on rather than falling back', async () => {
    await expect(orElse(Promise.resolve(null), 'fallback')).resolves.toBeNull()
    await expect(orElse(Promise.resolve(0), 7)).resolves.toBe(0)
  })
})
