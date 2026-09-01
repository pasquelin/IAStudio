import { describe, expect, it } from 'vitest'
import type { Memory, MemoryRef } from './assistantMemory'
import { memoryEdgesOf, neighboursOf } from './memoryGraph'

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
  it('says nothing at all about a memory that touches nothing', () => {
    expect(neighboursOf(memory(), [])).toEqual([])
  })

  it('gathers what it is about, and what else is about the same thing', () => {
    const root = memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })
    const other = memory({
      id: 'm_other',
      summary: 'le rig pilote le rail',
      refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
    })

    expect(neighboursOf(root, [root, other])).toEqual([
      {
        tie: 'about',
        rows: [
          {
            label: 'Scripts/Cam.ts',
            memoryId: null,
            alsoAbout: [{ label: 'le rig pilote le rail', memoryId: 'm_other', alsoAbout: [] }],
          },
        ],
      },
    ])
  })

  /** 🛑 A memory listed among its own neighbours reads as a cycle. */
  it('never lists the chosen memory among what else is about the same thing', () => {
    const root = memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })

    expect(neighboursOf(root, [root])[0]?.rows[0]?.alsoAbout).toEqual([])
  })

  it('shows what it links to and what it replaced, by their own words', () => {
    const replaced = memory({ id: 'm_old', summary: 'ce qui était cru avant' })
    const linked = memory({ id: 'm_two', summary: 'le script du rail' })
    const root = memory({ links: ['m_two'], supersedes: 'm_old' })

    const sections = neighboursOf(root, [root, linked, replaced])

    expect(sections.find(one => one.tie === 'links')?.rows[0]?.label).toBe('le script du rail')
    expect(sections.find(one => one.tie === 'replaces')?.rows[0]?.label).toBe(
      'ce qui était cru avant',
    )
  })

  /** A link may outlive its target — the id is all that is left of one that is gone. */
  it('shows the id alone for a memory the link no longer finds, and opens nothing', () => {
    const row = neighboursOf(memory({ links: ['m_gone'] }), [])[0]?.rows[0]

    expect(row).toEqual({ label: 'm_gone', memoryId: null, alsoAbout: [] })
  })

  // The whole point of sections: a title is a sentence, so no row has to carry the relation, and
  // the second level cannot inherit the first one's word the way the tree made it.
  it('keeps each tie in its own section rather than naming it on every row', () => {
    const root = memory({
      refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
      links: ['m_two'],
      supersedes: 'm_old',
    })

    expect(neighboursOf(root, []).map(one => one.tie)).toEqual(['about', 'links', 'replaces'])
  })
})

describe('what ties the memories of a whole project', () => {
  it('ties two memories that are about the same reference', () => {
    const one = memory({ id: 'm_one', refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })
    const two = memory({ id: 'm_two', refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })

    expect(memoryEdgesOf([one, two])).toEqual([{ from: 'm_one', to: 'm_two' }])
  })

  /** 🛑 A chain, not every pair: five memories on one file are four lines rather than ten. */
  it('chains a crowd on one reference rather than joining every pair', () => {
    const held = ['a', 'b', 'c', 'd', 'e'].map(id =>
      memory({ id, refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] }),
    )

    expect(memoryEdgesOf(held)).toHaveLength(4)
  })

  it('says nothing about a reference only one memory names', () => {
    expect(memoryEdgesOf([memory({ refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }] })])).toEqual([])
  })

  it('ties what one links to and what it replaced', () => {
    const root = memory({ id: 'm_root', links: ['m_two'], supersedes: 'm_old' })
    const tied = memoryEdgesOf([root, memory({ id: 'm_two' }), memory({ id: 'm_old' })])

    expect(tied).toEqual([
      { from: 'm_root', to: 'm_two' },
      { from: 'm_root', to: 'm_old' },
    ])
  })

  // A pair tied by a shared file AND by a link is one line: nothing draws the kind of tie.
  it('draws a pair tied two different ways as one line', () => {
    const ref: MemoryRef = { kind: 'file', ref: 'Scripts/Cam.ts' }
    const one = memory({ id: 'm_one', refs: [ref], links: ['m_two'] })
    const two = memory({ id: 'm_two', refs: [ref] })

    expect(memoryEdgesOf([one, two])).toHaveLength(1)
  })

  /** A link may outlive its target: a tie to a memory nobody holds would place a ghost. */
  it('drops a tie whose other end is not among the memories drawn', () => {
    expect(memoryEdgesOf([memory({ links: ['m_gone'] })])).toEqual([])
  })

  // Two memories tied both ways round is ONE line, or the graph draws it twice on itself.
  it('draws a pair tied twice as one line', () => {
    const one = memory({ id: 'm_one', links: ['m_two'] })
    const two = memory({ id: 'm_two', links: ['m_one'] })

    expect(memoryEdgesOf([one, two])).toHaveLength(1)
  })
})
