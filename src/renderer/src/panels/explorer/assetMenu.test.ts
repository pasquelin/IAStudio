import i18next from 'i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { showContextMenu } from '@/helpers/contextMenu'
import { assetMenuGroups } from './assetMenu'

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

/**
 * Raises the menu, since a native one leaves nothing on screen for a case to read.
 *
 * Through `showContextMenu`, because these are the two GROUPS the explorer's own menu ends on:
 * what a case reads is what the system was actually sent, submenus flattened in — see `fakeMenu`.
 */
function raise(subject: Asset | null = asset(), count = 1): void {
  void showContextMenu(assetMenuGroups({ asset: subject, count, t: i18next.t, onAsset }))
}

const onAsset = vi.fn()

const row = (pattern: RegExp): string | undefined =>
  menu.labels().find(label => pattern.test(label))

const offered = (pattern: RegExp): boolean | undefined => {
  const label = row(pattern)
  return label === undefined ? undefined : menu.offers(label)
}

describe('what the explorer offers to do with an asset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    vi.clearAllMocks()
  })

  /**
   * 🛑 Two groups and not ten rows, which is what moving here forced: this menu already offers
   * twelve gestures about the FILE, and flattening the asset's own into it made a list nobody
   * could read.
   */
  it('folds them into two groups rather than into the twelve rows already there', () => {
    raise()

    expect(row(/^Envoyer vers$/)).toBeDefined()
    expect(row(/^Asset$/)).toBeDefined()
  })

  // The three that act on the SELECTION rather than on the clicked row — they name their count.
  it('names how many rows the catalogue gestures will act on', () => {
    raise(asset(), 3)

    expect(row(/Nommer 3 assets/)).toBeDefined()
    expect(row(/Envoyer 3 assets/)).toBeDefined()
  })

  // Greyed on a selection holding no file the catalogue could answer for.
  it('greys the catalogue gestures out when nothing in the selection has a row', () => {
    raise(null, 0)

    expect(offered(/Nommer/)).toBe(false)
  })

  /**
   * 🛑 Left OUT and not greyed, which is the whole difference: the main process refuses a submenu
   * with no row, and it refuses the WHOLE menu with it — a right-click on any folder lost its
   * twelve other gestures, silently, since `fakeMenu` never validates what it is sent.
   */
  it('drops the destinations group rather than opening it onto nothing', () => {
    raise(null, 0)

    expect(row(/^Envoyer vers$/)).toBeUndefined()
    expect(row(/^Asset$/)).toBeDefined()
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
})
