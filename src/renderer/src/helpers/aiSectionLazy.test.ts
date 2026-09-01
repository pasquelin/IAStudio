import { describe, expect, it } from 'vitest'
import { aiSectionOf } from './aiSectionLazy'

describe('the settings screen a model line leads to', () => {
  it('names the family screen for a family', async () => {
    await expect(aiSectionOf('video')).resolves.toBe('ai.video')
  })

  /** The member that makes slicing the id at a call site wrong, rather than merely fragile. */
  it('answers for the families whose id carries a dash', async () => {
    await expect(aiSectionOf('background-removal')).resolves.toBe('ai.background-removal')
  })

  it('falls back to the manager for a family no screen chooses for', async () => {
    await expect(aiSectionOf('other')).resolves.toBe('ai')
    await expect(aiSectionOf(null)).resolves.toBe('ai')
  })
})
