import { describe, expect, it } from 'vitest'
import { actionIntents, actionReads } from './actionCapabilities'

describe('actionIntents', () => {
  it('reads the intent on the verb of the name when nothing is declared', () => {
    expect(actionIntents({ name: 'scene.state' })).toEqual(['read'])
    expect(actionIntents({ name: 'git.listCommitFiles' })).toEqual(['read'])
    expect(actionIntents({ name: 'node.remove' })).toEqual(['delete'])
  })

  it('lets a declaration override a verb that says otherwise', () => {
    expect(actionIntents({ name: 'git.diff', capabilities: { intents: ['read'] } })).toEqual([
      'read',
    ])
    expect(
      actionIntents({ name: 'component.attach', capabilities: { intents: ['create'] } }),
    ).toEqual(['create'])
  })

  it('answers nothing for a verb it does not know', () => {
    expect(actionIntents({ name: 'files.canUndoRedo' })).toEqual([])
  })
})

describe('actionReads', () => {
  it('holds for reads and searches only, and never for a name that says nothing', () => {
    expect(actionReads({ name: 'files.search' })).toBe(true)
    expect(
      actionReads({ name: 'memory.recall', capabilities: { intents: ['search', 'read'] } }),
    ).toBe(true)
    expect(actionReads({ name: 'key.write', capabilities: { intents: ['create', 'read'] } })).toBe(
      false,
    )
    expect(actionReads({ name: 'files.canUndoRedo' })).toBe(false)
  })
})
