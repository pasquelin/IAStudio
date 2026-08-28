import { describe, expect, it } from 'vitest'
import type { Memory } from './assistantMemory'
import { relationsOf } from './memoryGraph'

const memory = (fields: Partial<Memory> = {}): Memory => ({
  id: 'm_root',
  type: 'decision',
  summary: 'Les caméras suivent le rail',
  body: '',
  importance: 3,
  createdAt: '2026-08-01T10:00:00.000Z',
  source: { kind: 'person' },
  refs: [],
  links: [],
  state: 'live',
  ...fields,
})

describe('what a memory sits among', () => {
  it('roots the tree on the chosen memory', () => {
    const rows = relationsOf(memory(), [])

    expect(rows).toEqual([
      {
        id: 'm_root',
        parentId: null,
        label: 'Les caméras suivent le rail',
        relation: null,
        memoryId: 'm_root',
      },
    ])
  })

  it('hangs what it points at under it, and what else points there under that', () => {
    const root = memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })
    const other = memory({
      id: 'm_other',
      summary: 'le rig pilote le rail',
      refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
    })

    const rows = relationsOf(root, [root, other])
    const ref = rows.find(one => one.label === 'Scripts/Cam.ts')

    expect(ref?.parentId).toBe('m_root')
    expect(rows.find(one => one.memoryId === 'm_other')?.parentId).toBe(ref?.id)
  })

  /** 🛑 A memory listed among its own neighbours reads as a cycle. */
  it('never puts the root under its own reference', () => {
    const root = memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })
    const rows = relationsOf(root, [root])

    expect(rows.filter(one => one.memoryId === 'm_root')).toHaveLength(1)
  })

  it('shows what it links to and what it replaced, by their own words', () => {
    const replaced = memory({ id: 'm_old', summary: 'ce qui était cru avant' })
    const linked = memory({ id: 'm_two', summary: 'le script du rail' })
    const root = memory({ links: ['m_two'], supersedes: 'm_old' })

    const rows = relationsOf(root, [root, linked, replaced])

    expect(rows.find(one => one.relation === 'link')?.label).toBe('le script du rail')
    expect(rows.find(one => one.relation === 'supersedes')?.label).toBe('ce qui était cru avant')
  })

  /** A link may outlive its target — the id is all that is left of one that is gone. */
  it('shows the id alone for a memory the link no longer finds', () => {
    const rows = relationsOf(memory({ links: ['m_gone'] }), [])
    const link = rows.find(one => one.relation === 'link')

    expect(link?.label).toBe('m_gone')
    expect(link?.memoryId).toBeNull()
  })
})
