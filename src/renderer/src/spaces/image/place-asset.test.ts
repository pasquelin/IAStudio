import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { placeAsset } from './place-asset'

const DOCUMENT = 'image-1'

const picture: Asset = {
  id: 'asset-7',
  name: 'concept art',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-08T10:00:00.000Z',
}

beforeEach(() => {
  useCanvases.setState({ states: {}, histories: {} })
})

const stack = () => canvasOf(useCanvases.getState(), DOCUMENT)
const top = () => stack().layers.at(-1)

describe('placing an asset on a canvas', () => {
  it('adds a layer named after the picture', () => {
    placeAsset(DOCUMENT, picture)

    expect(top()?.name).toBe('concept art')
  })

  /**
   * The asset is written into the layer, not drawn at the engine: pixels pushed from here would
   * not survive an undo, a closed tab or a detached panel — and the engine does not know the
   * layer exists until one React commit later, so a direct draw landed nowhere at all.
   */
  it('records which asset the layer holds, so the pixels can be found again', () => {
    placeAsset(DOCUMENT, picture)

    expect(top()).toMatchObject({ kind: 'pixel', source: 'asset-7' })
  })

  // Dropping a picture and then painting on whatever was armed before is not what anyone means.
  it('arms the layer it just added', () => {
    placeAsset(DOCUMENT, picture)

    expect(stack().activeLayerId).toBe(top()?.id)
  })

  it('is one history entry, so undoing it takes the layer back off', () => {
    const before = stack().layers.length
    placeAsset(DOCUMENT, picture)
    useCanvases.getState().undo(DOCUMENT)

    expect(stack().layers).toHaveLength(before)
  })

  // The layer comes back carrying its asset, which is what makes the picture come back with it.
  it('brings the picture back with the layer on a redo', () => {
    placeAsset(DOCUMENT, picture)
    useCanvases.getState().undo(DOCUMENT)
    useCanvases.getState().redo(DOCUMENT)

    expect(top()).toMatchObject({ source: 'asset-7' })
  })

  it('refuses what is not a picture on this machine', () => {
    placeAsset(DOCUMENT, { ...picture, type: 'video' })
    placeAsset(DOCUMENT, { ...picture, location: 'cloud' })

    expect(stack().layers).toHaveLength(1)
  })
})
