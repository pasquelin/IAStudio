import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createSkyboxContent } from '@shared/domain/skybox'
import { skyboxPayload } from '@/features/shell/skyboxDocument'
import { installFakeBridge } from '@/services/fakeBridge'
import { forgetRememberedAssets, useAssets } from './assets'
import { litSkyOf, loadSkySource } from './skyboxSources'

/** One id per case: this store lives for the module, and a copy read in one test outlives it. */
let SKY = ''
let read = 0

/** The picture the sky names, as the catalogue answers for it. */
const picture = (): Asset => ({
  id: 'asset-sky',
  name: 'coucher',
  path: 'Ciels/coucher.hdr',
  type: 'skybox',
  location: 'local',
  tags: [],
  createdAt: '2026-08-26T10:00:00.000Z',
})

/**
 * What the studio actually WRITES for a sky — a glTF document, its own state riding in `extras`.
 * The internal payload instead is the shape that made a sibling test green while the viewport
 * went on showing nothing.
 */
function onDisk(): string {
  useAssets.setState({ items: [picture()] })
  const content = createSkyboxContent()
  content.source = { assetId: 'asset-sky' }
  content.sun = { ...content.sun, elevation: 0.5, intensity: 3 }
  content.adjustments = { ...content.adjustments, exposure: 1.5 }

  return JSON.stringify(skyboxPayload(content, SKY))
}

let answers = ''

describe('the skies a scene is lit by whose document is not open', () => {
  beforeEach(() => {
    useAssets.setState({ items: [picture()] })
    read += 1
    SKY = `sky-${read}`
    answers = onDisk()
    installFakeBridge({
      documents: {
        read: () =>
          Promise.resolve({
            id: SKY,
            kind: 'skybox',
            version: 1,
            title: 'Coucher',
            updatedAt: '2026-08-26T10:00:00.000Z',
            content: answers,
          }),
      },
    })
  })

  /**
   * Two ways to read this wrong, and both answer a DEFAULT sky rather than failing: the text of
   * `DocumentFile.content` handed straight to a reader that wants an object, and the parsed glTF
   * handed to a reader of the studio's own shape. A scene naming a sky nobody had opened was lit
   * by the procedural studio, and a scene lit by the studio is legal.
   */
  it('reads a sky nobody has opened off its file, sun and grading and all', async () => {
    await loadSkySource(SKY)

    const sky = litSkyOf(SKY)
    expect(sky?.source?.assetId).toBe('asset-sky')
    expect(sky?.sun.intensity).toBe(3)
    expect(sky?.adjustments.exposure).toBe(1.5)
  })

  /**
   * A sky written ELSEWHERE names its picture by a path alone — our own file carries the asset id
   * in `extras` beside it, which is why this decor amputates that half. Read before the catalogue
   * lands, the picture resolves to nothing, and a once-only read would keep that for the session.
   */
  it('reads a sky again when the first read resolved no picture', async () => {
    const held: Record<string, unknown> = JSON.parse(answers)
    delete held.extras
    answers = JSON.stringify(held)

    // `forgetRememberedAssets` as well as the empty shelf: the index KEEPS every asset it has
    // been shown, so emptying `items` alone leaves the picture answering.
    useAssets.setState({ items: [] })
    forgetRememberedAssets()
    await loadSkySource(SKY)
    expect(litSkyOf(SKY)?.source).toBeNull()

    // The catalogue LANDING is the signal; a shelf that merely grows is not.
    useAssets.setState({ items: [picture()] })
    expect(litSkyOf(SKY)).toBeNull()

    await loadSkySource(SKY)
    expect(litSkyOf(SKY)?.source?.assetId).toBe('asset-sky')
  })

  /**
   * Our own file carries the asset id in `extras`, so the picture is there whatever the catalogue
   * says — and this is what makes the retry above rare rather than the common case.
   */
  it('lights a scene from our own file before the catalogue has landed', async () => {
    useAssets.setState({ items: [] })
    forgetRememberedAssets()

    await loadSkySource(SKY)

    expect(litSkyOf(SKY)?.source?.assetId).toBe('asset-sky')
  })

  /** A sky that names NO picture is whole the moment it is read — the studio lights it. */
  it('keeps a sky that names no picture at all', async () => {
    answers = JSON.stringify(skyboxPayload(createSkyboxContent(), SKY))
    await loadSkySource(SKY)
    const first = litSkyOf(SKY)

    useAssets.setState({ items: [picture(), picture()] })

    expect(litSkyOf(SKY)).toBe(first)
  })

  it('reads that file once, however many scenes name it', async () => {
    await loadSkySource(SKY)
    const first = litSkyOf(SKY)

    await loadSkySource(SKY)

    expect(litSkyOf(SKY)).toBe(first)
  })

  /**
   * BOTH halves, and the tab half is the one that was missing: a montage clip followed the first
   * landing of a file and then no edit at all — measured, the pixels never moved again.
   */
  it('says the sky moved for an edit in its tab as well as for a read', async () => {
    const { onSkyChange } = await import('./skyboxSources')
    const { skyboxStore } = await import('./skyboxes')
    const { createSkyboxContent } = await import('@shared/domain/skybox')
    const moved = vi.fn()
    const stop = onSkyChange(moved)

    // Through `replace`, the door production brings a document in by — see the setup's own guard.
    skyboxStore.use.getState().replace(SKY, createSkyboxContent())
    expect(moved).toHaveBeenCalledTimes(1)

    await loadSkySource(SKY)
    expect(moved).toHaveBeenCalledTimes(2)

    stop()
    skyboxStore.use.getState().replace(SKY, createSkyboxContent())
    expect(moved).toHaveBeenCalledTimes(2)
  })
})
