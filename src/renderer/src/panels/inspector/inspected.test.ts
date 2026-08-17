import { describe, expect, it } from 'vitest'
import type { Selection } from '@/stores/selection'
import { inspectedTextureId } from './inspected'

const NONE: Selection = { kind: 'none' }

describe('which texture the inspector is showing', () => {
  it('is the texture in front when nothing else was clicked', () => {
    expect(inspectedTextureId(NONE, null, 'tex-1')).toBe('tex-1')
  })

  it('is none when no texture is open', () => {
    expect(inspectedTextureId(NONE, null, null)).toBeNull()
  })

  /** The reading order `InspectorFace` has always had: a scene in front wins over a texture. */
  it('is none when a scene is in front as well', () => {
    expect(inspectedTextureId(NONE, 'scene-1', 'tex-1')).toBeNull()
  })

  /**
   * A pick made in a panel is what one is looking at. Without this the title row would offer to
   * save a material while a video clip filled the panel below it.
   */
  const PICKED: readonly Selection[] = [
    { kind: 'asset', ownerId: null, ids: ['a1'] },
    { kind: 'clip', ownerId: 'doc-1', ids: ['c1'] },
    { kind: 'track', ownerId: 'doc-1', ids: ['t1'] },
    { kind: 'layer', ownerId: 'doc-1', ids: ['l1'] },
  ]

  it.each(PICKED)('is none while a $kind is selected', selection => {
    expect(inspectedTextureId(selection, null, 'tex-1')).toBeNull()
  })
})
