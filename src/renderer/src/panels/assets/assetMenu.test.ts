import i18next from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { openAssetMenu } from './assetMenu'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    location: 'local',
    path: 'assets/img/asset_1.png',
    tags: [],
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

let menu = fakeMenu()

/** Raises the menu, since a native one leaves nothing on screen for a case to read. */
function raise(subject: Asset = asset()): void {
  openAssetMenu({ asset: subject, t: i18next.t })
}

const row = (pattern: RegExp): string | undefined =>
  menu.labels().find(label => pattern.test(label))

const offered = (pattern: RegExp): boolean | undefined => {
  const label = row(pattern)
  return label === undefined ? undefined : menu.offers(label)
}

describe('what the shelf offers to do with an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
  })

  it('lists every destination that takes this kind', () => {
    raise()

    expect(row(/ciel/)).toBeDefined()
    expect(row(/calque/)).toBeDefined()
    expect(row(/montage/)).toBeDefined()
  })

  it('offers a take nothing a picture would take', () => {
    raise(asset({ type: 'audio' }))

    expect(row(/ciel/)).toBeUndefined()
    expect(row(/audio/)).toBeDefined()
  })

  // A menu that changes length depending on what is open is a menu one cannot learn.
  it('shows a destination with nowhere to put it, but greyed out', () => {
    raise()

    expect(offered(/ciel/)).toBe(false)
  })

  it('cannot show a cloud asset in a folder, since there is no file yet', () => {
    raise(asset({ location: 'cloud' }))

    expect(offered(/dans le dossier/)).toBe(false)
  })

  // The row used to be offered live whatever was open, because `ready` counted tabs and never
  // looked at the asset — a click that closed the menu and did nothing at all.
  it('greys out a destination its space is open for but that cannot take THIS asset', () => {
    installDocument('img-1', 'image')

    raise()
    expect(offered(/calque/)).toBe(true)

    raise(asset({ location: 'cloud' }))
    expect(offered(/calque/)).toBe(false)
  })

  // A destination with no document to write into has no landing to promise, and an always-live
  // row would offer one anyway. Open somewhere is enough — the row does not care which tab is
  // in front, since choosing it brings its document forward.
  it('greys out the montage when no sequence is open at all', () => {
    raise()
    expect(offered(/montage/)).toBe(false)

    installDocument('seq-1', 'video')
    raise()
    expect(offered(/montage/)).toBe(true)
  })

  /**
   * A `.glb` keeps its pictures inside itself, where nothing in the studio can open them. This
   * row is what turns them into assets — and the first half of editing a downloaded model's own
   * texture, which is the whole point of it existing.
   */
  it('offers to take the pictures out of a model, and of nothing else', () => {
    raise(asset({ type: 'mesh' }))
    expect(offered(/^Extraire/)).toBe(true)

    raise(asset({ type: 'image' }))
    expect(row(/^Extraire/)).toBeUndefined()
  })

  // The pictures are read off the file, so there has to be one.
  it('cannot take them out of a model that is only in the library', () => {
    raise(asset({ type: 'mesh', location: 'cloud' }))

    expect(offered(/^Extraire/)).toBe(false)
  })

  it('asks the main process for them, and re-reads the shelf once they are there', async () => {
    const extractTextures = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ menu: menu.bridge, assets: { extractTextures } })
    menu.picks(i18next.t('assets.extractTextures'))

    raise(asset({ type: 'mesh' }))

    await vi.waitFor(() => expect(extractTextures).toHaveBeenCalledWith('asset_1'))
  })

  /**
   * A texture is assembled in its own space, which writes no image back — so without this row an
   * extracted map could be looked at and never retouched, and `replaces` had nothing to bite on.
   */
  it('offers to edit the pixels of a picture whose own space does not paint', () => {
    raise(asset({ type: 'texture' }))

    expect(row(/Modifier l’image/)).toBeDefined()
  })

  // Images already opens one on a double-click: a second row for the same gesture is noise.
  it('offers nothing of the sort for a picture Images already opens', () => {
    raise()

    expect(row(/Modifier l’image/)).toBeUndefined()
  })

  /**
   * Handed back to the host rather than commanded here — the field belongs to the tile the name
   * is read on, and this menu is gone by the time it opens. The layer menu is the same shape.
   */
  it('hands the rename back to the row instead of commanding it', async () => {
    const onRename = vi.fn()
    menu.picks(i18next.t('assets.rename'))

    openAssetMenu({ asset: asset(), t: i18next.t, onRename })

    await vi.waitFor(() => expect(onRename).toHaveBeenCalled())
  })

  // A host that draws no name has nothing to open — a job still generating has a tile and no row.
  it('says nothing about renaming where no name is drawn', () => {
    raise()

    expect(row(/Renommer/)).toBeUndefined()
  })
})
