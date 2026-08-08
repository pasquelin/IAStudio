import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { registerCanvas } from './canvas-hosts'
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

/** What the engine was asked to draw, as `<layerId> <url>`. */
let loads: string[] = []
let release = (): void => undefined

beforeEach(() => {
  loads = []
  release()
  release = registerCanvas(DOCUMENT, {
    loadInto: (layerId, url) => {
      loads.push(`${layerId} ${url}`)
      return Promise.resolve()
    },
  })
  useCanvases.getState().drop(DOCUMENT)
})

const stack = () => canvasOf(useCanvases.getState(), DOCUMENT)

describe('placing an asset on a canvas', () => {
  it('adds a layer named after the picture', async () => {
    await placeAsset(DOCUMENT, picture)

    expect(stack().layers.at(-1)?.name).toBe('concept art')
  })

  // Dropping a picture and then painting on whatever was armed before is not what anyone means.
  it('arms the layer it just added', async () => {
    await placeAsset(DOCUMENT, picture)

    expect(stack().activeLayerId).toBe(stack().layers.at(-1)?.id)
  })

  it('draws the picture into that layer, over the asset scheme', async () => {
    await placeAsset(DOCUMENT, picture)

    expect(loads).toEqual([`${stack().activeLayerId} scenario://asset/asset-7`])
  })

  it('is one history entry, so undoing it takes the layer back off', async () => {
    const before = stack().layers.length
    await placeAsset(DOCUMENT, picture)
    useCanvases.getState().undo(DOCUMENT)

    expect(stack().layers).toHaveLength(before)
  })

  it('refuses what is not a picture on this machine', async () => {
    await placeAsset(DOCUMENT, { ...picture, type: 'video' })
    await placeAsset(DOCUMENT, { ...picture, location: 'cloud' })

    expect(loads).toEqual([])
    expect(stack().layers).toHaveLength(1)
  })

  // The tab can be closed between the drop and the moment this runs.
  it('does nothing for a document whose engine is gone', async () => {
    release()
    release = () => undefined

    await placeAsset(DOCUMENT, picture)

    expect(loads).toEqual([])
    expect(stack().layers).toHaveLength(1)
  })
})
