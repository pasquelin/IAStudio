import { describe, expect, it } from 'vitest'
import type { Memory } from './assistantMemory'
import { neighboursOf } from './memoryGraph'

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
