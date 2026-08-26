import { describe, expect, it } from 'vitest'
import { refFromString, refToString, type Ref } from './ref'

const EVERY_KIND: readonly Ref[] = [
  { kind: 'asset', id: 'asset_9d1f' },
  { kind: 'document', id: '3f2a-11e9' },
  { kind: 'prefab', id: 'prefab_torch' },
  { kind: 'script', path: 'scripts/player.ts' },
  { kind: 'entity', document: '3f2a-11e9', id: 'a1b2' },
  { kind: 'track', document: '3f2a-11e9', id: 't1' },
  { kind: 'clip', document: '3f2a-11e9', id: 'clip_1' },
  { kind: 'shot', document: '3f2a-11e9', id: 's1' },
  { kind: 'layer', document: '3f2a-11e9', id: 'l1' },
  { kind: 'component', document: '3f2a-11e9', entity: 'a1b2', type: 'rigidBody' },
]

describe('a reference written as a string', () => {
  it('comes back as the reference it was, whatever it names', () => {
    for (const ref of EVERY_KIND) expect(refFromString(refToString(ref))).toEqual(ref)
  })

  it('keeps every separator of a script path, which is not an identifier', () => {
    expect(refToString({ kind: 'script', path: 'game/npc/walk.ts' })).toBe(
      'script:game/npc/walk.ts',
    )
  })

  it('answers nothing, rather than throwing, for a string that names no reference', () => {
    const refused = [
      '',
      'asset',
      ':asset_1',
      'asset:',
      'sprite:a1b2',
      'entity:3f2a',
      'entity:3f2a/a1b2/extra',
      'entity:/a1b2',
      'asset:a1b2/c3d4',
      'component:3f2a/a1b2',
      'script:',
    ]

    for (const text of refused) expect(refFromString(text)).toBeNull()
  })

  /**
   * The price of a readable form, asserted rather than left to be found: `/` separates the parts,
   * so an identifier holding one writes a string that cannot be read back. Nothing in this
   * repository mints such an identifier — this case is what would notice the day something did.
   */
  it('cannot read back an identifier holding the separator', () => {
    expect(refFromString(refToString({ kind: 'asset', id: 'a/b' }))).toBeNull()
  })
})
