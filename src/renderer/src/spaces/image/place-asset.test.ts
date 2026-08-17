import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { DEFAULT_CANVAS } from '@/engines/canvas/canvasState'
import { reportFailure } from '@/services/diagnostics'
import { canvasOf, canvasStore, useCanvases } from '@/stores/canvases'
import { becomeAsset, placeAsset } from './place-asset'

vi.mock('@/services/diagnostics', () => ({ reportFailure: vi.fn() }))

const said = () => vi.mocked(reportFailure).mock.calls.map(([, , error]) => String(error))

/**
 * Both warnings below are `canvas.size`, NOT `assets.open`, and each case asserts it: the
 * document opens here — the layer is built and the state written right after — so filing them
 * under `assets.open` told the reader « this asset has nowhere to go » at the moment the picture
 * appeared on screen. One scope cannot carry a failure to open and a warning about the size of
 * what did open.
 */
const scopes = () => vi.mocked(reportFailure).mock.calls.map(([scope]) => scope)

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
  vi.mocked(reportFailure).mockClear()
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

/**
 * What a double-click makes, as opposed to a drop. The distinction is what ⌘S is allowed to
 * write back: a picture dropped onto a default canvas is a 1024² white-matted crop of itself,
 * and flattening THAT over the asset deleted the original file.
 */
describe('making a document be the asset', () => {
  const measuring = (width: number, height: number) => () => Promise.resolve({ width, height })

  it('takes the picture’s own size, not the default canvas', async () => {
    await becomeAsset(DOCUMENT, picture, measuring(4096, 2048))

    expect(stack()).toMatchObject({ width: 4096, height: 2048 })
  })

  // One layer, and no fill on it: the white base of a fresh canvas would be baked into every
  // transparent pixel the moment ⌘S flattened the stack back onto the asset.
  it('holds the picture alone, over nothing', async () => {
    await becomeAsset(DOCUMENT, picture, measuring(800, 600))

    expect(stack().layers).toHaveLength(1)
    expect(stack().layers[0]).toMatchObject({ kind: 'pixel', source: 'asset-7', fill: undefined })
  })

  /**
   * The one that matters most. Opening is not an edit, and `placeAsset` made it one by running
   * `addLayer` as a history command — so the tab was MODIFIED before the user touched it, and
   * the guard meant to keep a reflex ⌘S off the original file never fired once.
   */
  it('leaves the tab unmodified, because opening is not an edit', async () => {
    await becomeAsset(DOCUMENT, picture, measuring(800, 600))

    expect(canvasStore.hasUnsavedWork(useCanvases.getState(), DOCUMENT)).toBe(false)
  })

  // A picture that will not decode still opens, rather than not opening at all.
  it('falls back to the default size when the picture will not measure', async () => {
    await becomeAsset(DOCUMENT, picture, () => Promise.reject(new Error('gone')))

    expect(stack()).toMatchObject({ width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height })
  })

  /**
   * The silence that cost a file. ⌘S writes the document's size back over the asset, so a
   * document that is not the picture is one whose save will not be faithful — and this was the
   * only way it could happen without a word. A 4112 × 2658 photo sat in a 1024² document, the
   * inspector went on showing the photo's dimensions, and the save shrank the file to the
   * document. The ceiling biting was already said; this half was not.
   */
  it('says so when the picture will not measure, because the document is then not the picture', async () => {
    await becomeAsset(DOCUMENT, picture, () => Promise.reject(new Error('gone')))

    expect(said()).toEqual([expect.stringContaining('would not measure')])
    expect(scopes()).toEqual(['canvas.size'])
  })

  it('says so when the ceiling brought the picture under its own size', async () => {
    await becomeAsset(DOCUMENT, picture, measuring(20000, 10000))

    expect(said()).toEqual([expect.stringContaining('below its own size')])
    expect(scopes()).toEqual(['canvas.size'])
  })

  // The ordinary case, and the one that must stay quiet: a document that IS its picture.
  it('says nothing when the document measures exactly what the picture does', async () => {
    await becomeAsset(DOCUMENT, picture, measuring(4096, 2048))

    expect(said()).toEqual([])
  })

  it('refuses what is not a picture on this machine', async () => {
    await becomeAsset(DOCUMENT, { ...picture, location: 'cloud' }, measuring(800, 600))

    // Untouched, not merely unchanged in shape: nothing of the asset reached the document.
    expect(stack()).toEqual(DEFAULT_CANVAS)
  })
})
