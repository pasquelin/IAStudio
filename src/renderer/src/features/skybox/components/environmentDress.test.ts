import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { environmentDressOf } from './environmentDress'

const litSkyOf = vi.fn<(skyId: string) => SkyboxContent | null>(() => null)
const loadSkySource = vi.fn(() => Promise.resolve())

vi.mock('@/stores/skyboxSources', () => ({
  litSkyOf: (skyId: string) => litSkyOf(skyId),
  loadSkySource: () => loadSkySource(),
}))

describe('what a scene environment is worth to it', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    litSkyOf.mockReturnValue(null)
  })

  it('lights from the studio when the document names nothing', () => {
    expect(environmentDressOf({ kind: 'studio' })).toBeNull()
  })

  it('hangs a picture on its own, ungraded and with no sun', () => {
    const dress = environmentDressOf({ kind: 'skybox', assetId: 'asset-1' })

    expect(dress).toEqual({
      assetId: 'asset-1',
      adjustments: NEUTRAL_ADJUSTMENTS,
      sun: null,
      intensity: 1,
    })
  })

  /**
   * Asked on every apply of every viewport, and the engine tells « nothing moved » by IDENTITY: a
   * fresh object each time would be a shadow pass a frame for a sky nobody touched.
   */
  it('answers the same object for the same picture', () => {
    const first = environmentDressOf({ kind: 'skybox', assetId: 'asset-1' })

    expect(environmentDressOf({ kind: 'skybox', assetId: 'asset-1' })).toBe(first)
  })

  it('answers the same object for the same sky, and a new one once it is edited', () => {
    const sky = createSkyboxContent()
    litSkyOf.mockReturnValue(sky)

    const first = environmentDressOf({ kind: 'sky', documentId: 'sky-1' })
    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })).toBe(first)

    litSkyOf.mockReturnValue({ ...sky, sun: { ...sky.sun, intensity: 4 } })
    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })?.sun?.intensity).toBe(4)
  })

  // The studio until the file lands, with the read fired on the way so the next frame has it.
  it('reads a sky no tab holds, and lights from the studio meanwhile', () => {
    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })).toBeNull()
    expect(loadSkySource).toHaveBeenCalled()
  })

  it('takes the sky whole — its graded picture, its sun and its strength', () => {
    const sky = createSkyboxContent()
    sky.source = { assetId: 'asset-sky' }
    sky.adjustments = { ...sky.adjustments, exposure: 1.5 }
    sky.environment = { ...sky.environment, intensity: 0.4 }
    litSkyOf.mockReturnValue(sky)

    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })).toEqual({
      assetId: 'asset-sky',
      adjustments: sky.adjustments,
      sun: sky.sun,
      intensity: 0.4,
    })
  })

  /**
   * A sky edited on something the scene does NOT take — `showBackground`, a generation landing —
   * hands back the very same dress, or every scene naming it pays a shadow pass for no news.
   */
  it('answers the same object when the sky moved on nothing a scene takes', () => {
    const sky = createSkyboxContent()
    litSkyOf.mockReturnValue(sky)
    const first = environmentDressOf({ kind: 'sky', documentId: 'sky-1' })

    litSkyOf.mockReturnValue({ ...sky, environment: { ...sky.environment, showBackground: false } })

    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })).toBe(first)
  })

  // Held per SKY: one slot for all of them and two viewports on two skies cancel each other out.
  it('holds that answer per sky, whatever else is being asked for', () => {
    const one = createSkyboxContent()
    litSkyOf.mockImplementation(id => (id === 'sky-1' ? one : createSkyboxContent()))
    const first = environmentDressOf({ kind: 'sky', documentId: 'sky-1' })

    environmentDressOf({ kind: 'sky', documentId: 'sky-2' })
    litSkyOf.mockImplementation(id =>
      id === 'sky-1' ? { ...one, environment: { ...one.environment, showBackground: false } } : one,
    )

    expect(environmentDressOf({ kind: 'sky', documentId: 'sky-1' })).toBe(first)
  })
})
