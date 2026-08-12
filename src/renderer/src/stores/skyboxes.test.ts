import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createSkyboxContent } from '@shared/domain/skybox'
import { skyboxHistoryOf, setSkyboxSource, useSkyboxes } from './skyboxes'

const picture = (id: string): Asset => ({
  id,
  name: id,
  type: 'skybox',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
})

const entries = (documentId: string): number =>
  skyboxHistoryOf(useSkyboxes.getState(), documentId).past.length

/**
 * The only asynchronous writer in the studio: a generation lands whenever it lands, and a drop
 * lands wherever it is let go. Neither belongs to the cursor a panel may be holding.
 */
describe('setSkyboxSource', () => {
  const open = (documentId: string): void => {
    useSkyboxes.getState().ensure(documentId, createSkyboxContent)
  }

  it('hangs the picture in the sky', () => {
    open('sky-1')

    setSkyboxSource('sky-1', picture('asset-dusk'))

    expect(entries('sky-1')).toBe(1)
  })

  /**
   * The defect, seen from where it happened: written through `runCommand`, two landings during a
   * held cursor coalesced into one entry — `applyGeneration` carries the constant id
   * `'generation'`, so the store took the second for the continuation of the first.
   */
  it('keeps two landings apart even while a gesture is held', () => {
    open('sky-2')
    useSkyboxes.getState().beginGesture('sky-2')

    setSkyboxSource('sky-2', picture('asset-dawn'))
    setSkyboxSource('sky-2', picture('asset-dusk'))

    expect(entries('sky-2')).toBe(2)
  })

  // A field opens its gesture on focus, before writing anything: a landing must not name it.
  it('leaves an untouched gesture free to collapse afterwards', () => {
    open('sky-3')
    const { beginGesture, runCommand } = useSkyboxes.getState()
    beginGesture('sky-3')

    setSkyboxSource('sky-3', picture('asset-dawn'))
    const slide = (rotation: number) => ({
      id: 'sky:rotation',
      apply: (state: ReturnType<typeof createSkyboxContent>) => ({ ...state, rotation }),
      revert: (state: ReturnType<typeof createSkyboxContent>) => state,
    })
    for (const rotation of [10, 20, 30]) runCommand('sky-3', slide(rotation))

    // The landing, then the whole drag as one — not one entry per frame.
    expect(entries('sky-3')).toBe(2)
  })

  // A cloud asset answers 404 for its file, which the engine cannot tell from a black sky.
  it('refuses a picture that is not on disk', () => {
    open('sky-4')

    setSkyboxSource('sky-4', { ...picture('asset-remote'), location: 'cloud' })

    expect(entries('sky-4')).toBe(0)
  })
})
