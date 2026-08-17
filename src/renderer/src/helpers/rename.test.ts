import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { renameAsset, renameDocument } from './rename'

const reportFailure = vi.hoisted(() => vi.fn())
vi.mock('@/services/diagnostics', () => ({ reportFailure }))

const POSTER: DocumentDescriptor = {
  id: 'doc-1',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
  path: 'documents/Poster.img',
}

const ASSET: Asset = {
  id: 'asset_1',
  name: 'Pas courus',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07',
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: { 'doc-1': POSTER }, stored: [POSTER] })
  useAssets.setState({ items: [ASSET] })
})

/**
 * The field commits on blur as much as on Enter, so it is gone before the disk has replied: the
 * activity journal is where the studio says what a gesture could not do. Four hosts of a
 * document's name and two of an asset's used to drop that answer on the floor.
 */
describe('renaming from wherever a name is read', () => {
  it('says nothing and asks nothing when the name did not change', async () => {
    const rename = vi.fn()
    installFakeBridge({ documents: { rename } })

    renameDocument('doc-1', 'Poster', 'Poster')
    await vi.waitFor(() => expect(reportFailure).not.toHaveBeenCalled())

    expect(rename).not.toHaveBeenCalled()
  })

  it('journals the refusal the folder came back with', async () => {
    installFakeBridge({ documents: { rename: () => Promise.reject(new Error('duplicate-name')) } })

    renameDocument('doc-1', 'Poster', 'Affiche')

    await vi.waitFor(() =>
      expect(reportFailure).toHaveBeenCalledWith(
        'document.rename',
        'Affiche',
        new Error('duplicate'),
      ),
    )
  })

  // A name the window can already tell is unusable never reaches the disk, and still says so.
  it('journals a title the disk could not hold, without asking it', async () => {
    const rename = vi.fn()
    installFakeBridge({ documents: { rename } })

    renameDocument('doc-1', 'Poster', 'Brique 1/2')

    await vi.waitFor(() => expect(reportFailure).toHaveBeenCalled())
    expect(rename).not.toHaveBeenCalled()
  })

  it('says nothing at all when the rename went through', async () => {
    installFakeBridge({
      documents: { rename: () => Promise.resolve({ ...POSTER, title: 'Affiche' }) },
    })

    renameDocument('doc-1', 'Poster', 'Affiche')

    await vi.waitFor(() => expect(useDocuments.getState().stored[0]?.title).toBe('Affiche'))
    expect(reportFailure).not.toHaveBeenCalled()
  })

  it('journals an asset the catalogue refused', async () => {
    installFakeBridge({ assets: { update: () => Promise.reject(new Error('no')) } })

    renameAsset('asset_1', 'Pas courus', 'Pas dans les feuilles')

    await vi.waitFor(() =>
      expect(reportFailure).toHaveBeenCalledWith(
        'assets.rename',
        'Pas dans les feuilles',
        expect.any(Error),
      ),
    )
  })
})

/**
 * Measured in the app on 16 August: renaming an asset in the explorer changed the shelf and left
 * the TAB editing it reading `asset_UjmhYgPhewvzGCx2tD1jxvwL`. A document opened from an asset is
 * called after it — `openAsset` copies the name across — and nothing carried a later rename over.
 */
describe('the tabs editing a renamed asset', () => {
  const editor: DocumentDescriptor = {
    id: 'doc-2',
    kind: 'image',
    title: 'Pas courus',
    workspace: 'image',
    path: 'documents/Pas courus.img',
    sourceAssetId: 'asset_1',
  }

  const renamedAsset = { ...ASSET, name: 'Pas dans les feuilles' }

  it('take the name with it', async () => {
    const rename = vi.fn(() => Promise.resolve({ ...editor, title: 'Pas dans les feuilles' }))
    useDocuments.setState({ documents: { 'doc-2': editor }, stored: [editor] })
    installFakeBridge({
      assets: { update: () => Promise.resolve(renamedAsset) },
      documents: { rename },
    })

    renameAsset('asset_1', 'Pas courus', 'Pas dans les feuilles')

    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith('doc-2', 'image', 'Pas dans les feuilles'),
    )
  })

  /** A document of its own is not one of the asset's, however alike the two names happen to be. */
  it('leaves a document that was not opened from it alone', async () => {
    const rename = vi.fn()
    installFakeBridge({
      assets: { update: () => Promise.resolve(renamedAsset) },
      documents: { rename },
    })

    renameAsset('asset_1', 'Pas courus', 'Pas dans les feuilles')

    await vi.waitFor(() =>
      expect(useAssets.getState().items[0]?.name).toBe('Pas dans les feuilles'),
    )
    expect(rename).not.toHaveBeenCalled()
  })

  /**
   * A tab is renamed once, not twice: an open document is listed in `documents` AND in `stored`,
   * and the second call would come back `duplicate` against the name the first one just took.
   */
  it('rename an open document once, though it is listed twice', async () => {
    const rename = vi.fn(() => Promise.resolve({ ...editor, title: 'Pas dans les feuilles' }))
    useDocuments.setState({ documents: { 'doc-2': editor }, stored: [editor] })
    installFakeBridge({
      assets: { update: () => Promise.resolve(renamedAsset) },
      documents: { rename },
    })

    renameAsset('asset_1', 'Pas courus', 'Pas dans les feuilles')

    await vi.waitFor(() => expect(rename).toHaveBeenCalled())
    expect(rename).toHaveBeenCalledTimes(1)
  })

  /**
   * A document saved for an asset and then CLOSED lives only in the folder listing. Left behind,
   * it would hand the old name back the day it is reopened — the same defect, on a delay.
   */
  it('follow a document that is no longer open', async () => {
    const rename = vi.fn(() => Promise.resolve({ ...editor, title: 'Pas dans les feuilles' }))
    useDocuments.setState({ documents: {}, stored: [editor] })
    installFakeBridge({
      assets: { update: () => Promise.resolve(renamedAsset) },
      documents: { rename },
    })

    renameAsset('asset_1', 'Pas courus', 'Pas dans les feuilles')

    await vi.waitFor(() =>
      expect(rename).toHaveBeenCalledWith('doc-2', 'image', 'Pas dans les feuilles'),
    )
  })
})
