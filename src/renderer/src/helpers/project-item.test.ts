import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { itemOfAsset, itemOfPath } from './project-item'

const asset = (over: Partial<Asset> = {}): Asset => ({
  id: 'asset_1',
  name: 'Ruelle bleue',
  type: 'image',
  location: 'local',
  path: 'Repérages/ruelle.png',
  tags: [],
  createdAt: '2026-08-17T10:00:00.000Z',
  ...over,
})

const scene: DocumentDescriptor = {
  id: 'a3f1',
  kind: 'scene',
  title: 'Niveau',
  workspace: '3d',
  fileName: 'a3f1.scene',
}

describe('what the project holds, as one shape', () => {
  it('reads a file the catalogue never heard of from its name alone', () => {
    expect(itemOfPath('Repérages/ruelle.png')).toEqual({
      path: 'Repérages/ruelle.png',
      name: 'ruelle.png',
      domain: 'image',
      role: 'source',
      assetId: null,
      document: null,
      bytes: null,
    })
  })

  /**
   * The whole of « corrected by hand »: a normal map and an albedo are both PNGs, so the name
   * can only guess — and a row is the one thing that remembers what was answered.
   */
  it('lets the catalogue overrule what the extension guessed', () => {
    const item = itemOfPath('Repérages/ruelle.png', { asset: asset({ type: 'texture' }) })

    expect(item.domain).toBe('texture')
    expect(item.assetId).toBe('asset_1')
  })

  // What the explorer's rows show too: a document is called by its title, not by its file.
  it('calls a document by its title', () => {
    expect(itemOfPath('documents/a3f1.scene', { document: scene })).toMatchObject({
      name: 'Niveau',
      domain: 'mesh',
      role: 'edit',
    })
  })

  it('answers nothing for a row this project folder does not hold', () => {
    expect(itemOfAsset(asset({ path: undefined }))).toBeNull()
    expect(itemOfAsset(asset())?.path).toBe('Repérages/ruelle.png')
  })
})
