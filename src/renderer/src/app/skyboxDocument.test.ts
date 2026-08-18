import { beforeEach, describe, expect, it } from 'vitest'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { isRecord } from '@shared/guards'
import type { Asset } from '@shared/domain/asset'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { skyboxFromPayload, skyboxPayload } from './skyboxDocument'

const DOCUMENT = 'doc-sky'

const dusk = (): Asset => ({
  id: 'asset-dusk',
  name: 'dusk',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-18T10:00:00.000Z',
})

/** A sky filed two folders deep, so the link it writes has somewhere to climb out of. */
function openSky(path = 'Ciels/Nuit/Crépuscule.gltf'): void {
  useDocuments.setState({
    documents: {
      [DOCUMENT]: {
        id: DOCUMENT,
        kind: 'skybox',
        title: 'Crépuscule',
        workspace: 'skyboxes',
        path,
      },
    },
    activeId: DOCUMENT,
  })
}

const sky = (over: Partial<SkyboxContent> = {}): SkyboxContent => ({
  ...createSkyboxContent(),
  source: { assetId: 'asset-dusk' },
  ...over,
})

const uriOf = (payload: unknown): string => {
  const images = isRecord(payload) && Array.isArray(payload.images) ? payload.images : []
  const first = images[0]
  return isRecord(first) && typeof first.uri === 'string' ? first.uri : ''
}

beforeEach(() => {
  useAssets.setState({ items: [{ ...dusk(), path: 'Assets/dusk.hdr' }] })
})

describe('the picture a sky points at', () => {
  /**
   * Relative to the document's OWN folder, which is what makes a project movable — an absolute
   * link names the machine it was written on, and an asset id names nothing outside this studio.
   * The id rides in `extras` beside it, as a montage's does: the standard part is the path.
   */
  it('is a path out of the document’s folder', () => {
    openSky()

    expect(uriOf(skyboxPayload(sky(), DOCUMENT))).toBe('../../Assets/dusk.hdr')
  })

  it('is a plain name for a sky filed beside its picture', () => {
    openSky('Assets/Crépuscule.gltf')

    expect(uriOf(skyboxPayload(sky(), DOCUMENT))).toBe('dusk.hdr')
  })

  /** Percent-encoded on the way out, and taken apart segment by segment on the way back. */
  it('survives a folder whose name needs escaping', () => {
    useAssets.setState({ items: [{ ...dusk(), path: 'Été 2026/dusk.hdr' }] })
    openSky('Ciels/Crépuscule.gltf')

    const written = skyboxPayload(sky(), DOCUMENT)
    expect(uriOf(written)).toContain('%C3%89t%C3%A9')
    expect(skyboxFromPayload(written, DOCUMENT)).toMatchObject({
      source: { assetId: 'asset-dusk' },
    })
  })

  /** The gesture the whole format is for: written, read back, and the same sky on both sides. */
  it('comes back as the sky that was written', () => {
    openSky()
    const content = sky({ sun: { elevation: 0.4, azimuth: 2, intensity: 3, color: '#88aaff' } })

    expect(skyboxFromPayload(skyboxPayload(content, DOCUMENT), DOCUMENT)).toEqual(content)
  })

  /**
   * The link is KEPT when the path answers nothing, and that is not laxity: this window's
   * catalogue holds only what it has been SHOWN, so a picture whose row has not been listed yet
   * answers nothing — and dropping the link would lose it for good at the next ⌘S.
   */
  it('keeps the link it was given when nothing here answers the path', () => {
    const written = skyboxPayload(sky(), DOCUMENT)
    useAssets.setState({ items: [] })

    expect(skyboxFromPayload(written, DOCUMENT)).toMatchObject({
      source: { assetId: 'asset-dusk' },
    })
  })

  /** A sky copied into another project finds its picture by the path, not by the stale id. */
  it('prefers the picture the path names over the id the file also carries', () => {
    openSky()
    const written = skyboxPayload(sky(), DOCUMENT)
    useAssets.setState({ items: [{ ...dusk(), id: 'asset-elsewhere', path: 'Assets/dusk.hdr' }] })

    expect(skyboxFromPayload(written, DOCUMENT)).toMatchObject({
      source: { assetId: 'asset-elsewhere' },
    })
  })
})
