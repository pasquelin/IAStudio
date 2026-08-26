// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createBundledAssets } from './bundledAssets'

describe('where an exported game serves an asset from', () => {
  it('answers the file shipped beside it, and nothing for what it did not ship', () => {
    const assets = createBundledAssets({ asset_1: 'assets/torch.png' })

    expect(assets.urlOf({ kind: 'asset', id: 'asset_1' })).toBe('assets/torch.png')
    expect(assets.urlOf({ kind: 'asset', id: 'asset_2' })).toBeNull()
    expect(assets.urlOf({ kind: 'script', path: 'scripts/player.ts' })).toBeNull()
  })

  /** A plain record answers for what it inherits, and `?? null` never sees it. */
  it('answers nothing for a name every object carries', () => {
    const assets = createBundledAssets({ asset_1: 'assets/torch.png' })

    expect(assets.urlOf({ kind: 'asset', id: 'constructor' })).toBeNull()
    expect(assets.urlOf({ kind: 'asset', id: '__proto__' })).toBeNull()
  })
})
