import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { MtlxDocument } from '@shared/domain/materialX'
import { TRANSLATIONS } from '@shared/i18n'
import { newMaterial, type MaterialState } from '@/engines/material/materialState'
import { forgetRememberedAssets, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import {
  forgetCarriedMaterial,
  materialRefusesToSave,
  materialFromPayload,
  materialPayload,
} from './materialDocument'

const DOCUMENT = 'doc-mat'

const brick = (): Asset => ({
  id: 'asset-brick',
  name: 'brick',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-18T10:00:00.000Z',
})

/** A material filed two folders deep, so the link it writes has somewhere to climb out of. */
function openMaterial(path = 'Matières/Murs/Brique.mtlx'): void {
  useDocuments.setState({
    documents: {
      [DOCUMENT]: { id: DOCUMENT, kind: 'material', title: 'Brique', workspace: 'materials', path },
    },
    activeId: DOCUMENT,
  })
}

function withBaseColour(assetId: string): MaterialState {
  const base = newMaterial()
  return {
    ...base,
    channels: { baseColor: { assetId, origin: 'imported', width: 8, height: 8 } },
  }
}

const filesOf = (payload: MtlxDocument): string[] => payload.images.map(image => image.file)

/**
 * Emptying `items` is NOT emptying the catalogue: `assetsById` accumulates over what it already
 * held, deliberately, and only `forgetRememberedAssets` shrinks it. A case that sets `items: []`
 * alone still resolves every asset a previous line put there — which is a green that measures
 * the wrong half.
 */
function emptyCatalogue(): void {
  useAssets.setState({ items: [] })
  forgetRememberedAssets()
}

/**
 * The refusal is a SENTENCE, so the bundles have to be loaded for it to be one. Straight into
 * i18next rather than through `initI18n`, which reads `localStorage` and writes on the document.
 */
beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    defaultNS: 'studio',
    resources: { fr: { studio: TRANSLATIONS.fr } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  openMaterial()
  forgetCarriedMaterial(DOCUMENT)
  forgetRememberedAssets()
  useAssets.setState({ items: [{ ...brick(), path: 'Assets/brick.png' }] })
})

describe('the pictures a material points at', () => {
  it('writes each channel as a path relative to the document own folder', () => {
    expect(filesOf(materialPayload(withBaseColour('asset-brick'), DOCUMENT))).toEqual([
      '../../Assets/brick.png',
    ])
  })

  /**
   * The case the memory exists FOR, and the one the sky already paid: this window holds only the
   * assets it has been SHOWN. A channel whose row is not in the catalogue would otherwise write no
   * path at all, and the next ⌘S would take the picture out of the file for every other reader.
   */
  it('keeps the path the file carried when the catalogue answers nothing', () => {
    materialFromPayload(materialPayload(withBaseColour('asset-brick'), DOCUMENT), DOCUMENT)
    emptyCatalogue()

    expect(filesOf(materialPayload(withBaseColour('asset-brick'), DOCUMENT))).toEqual([
      '../../Assets/brick.png',
    ])
  })

  /** The catalogue wins over the memory: an asset that MOVED is written where it is now. */
  it('prefers the catalogue to what the file said', () => {
    materialFromPayload(materialPayload(withBaseColour('asset-brick'), DOCUMENT), DOCUMENT)
    useAssets.setState({ items: [{ ...brick(), path: 'Assets/Murs/brick.png' }] })

    expect(filesOf(materialPayload(withBaseColour('asset-brick'), DOCUMENT))).toEqual([
      '../../Assets/Murs/brick.png',
    ])
  })

  it('drops the memory with the document, so a reopened id inherits no path', () => {
    materialFromPayload(materialPayload(withBaseColour('asset-brick'), DOCUMENT), DOCUMENT)
    forgetCarriedMaterial(DOCUMENT)
    emptyCatalogue()

    expect(filesOf(materialPayload(withBaseColour('asset-brick'), DOCUMENT))).toEqual([])
  })
})

describe('a material that opened holding more than the studio composes', () => {
  const held = (extra: readonly string[]): MtlxDocument => ({
    images: [],
    values: [],
    studio: {},
    extra,
  })

  it('refuses nothing for a file the studio composed whole', () => {
    materialFromPayload(materialPayload(newMaterial(), DOCUMENT), DOCUMENT)

    expect(materialRefusesToSave(DOCUMENT)).toBeNull()
  })

  /**
   * A save recomposes the surface from six inputs. A file carrying `coat` or a second material
   * would come back with them deleted, and the file is the only copy — so the write is refused
   * rather than made silently lossy.
   */
  it('refuses to save one that came back holding an input it cannot write', () => {
    materialFromPayload(held(['input:coat', 'input:specular']), DOCUMENT)

    expect(materialRefusesToSave(DOCUMENT)).toContain('MaterialX')
  })

  it('lifts the refusal when the file comes back without them', () => {
    materialFromPayload(held(['input:coat']), DOCUMENT)
    expect(materialRefusesToSave(DOCUMENT)).not.toBeNull()

    materialFromPayload(materialPayload(newMaterial(), DOCUMENT), DOCUMENT)
    expect(materialRefusesToSave(DOCUMENT)).toBeNull()
  })

  it('refuses nothing for bytes that are not a material at all', () => {
    materialFromPayload({ not: 'a material' }, DOCUMENT)

    expect(materialRefusesToSave(DOCUMENT)).toBeNull()
  })
})
