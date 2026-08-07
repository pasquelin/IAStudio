import { describe, expect, it } from 'vitest'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { workspaceById, workspaceLabelKey, WORKSPACES } from './workspaces'

describe('workspaces', () => {
  it('gives every workspace a translatable label key', () => {
    for (const workspace of WORKSPACES) {
      expect(workspaceLabelKey(workspace.id)).toBe(`workspaces.${workspace.id}`)
    }
  })

  it('finds a workspace by its id', () => {
    expect(workspaceById('3d').family).toBe('3d')
  })

  it('rejects an unknown id instead of returning an empty workspace', () => {
    expect(() => workspaceById('nope')).toThrow()
  })

  it('maps every workspace to a model family', () => {
    for (const workspace of WORKSPACES) expect(workspace.family).toBeTruthy()
  })

  it('has no two workspaces sharing an id', () => {
    const ids = WORKSPACES.map(workspace => workspace.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a default workspace that exists', () => {
    expect(WORKSPACES.some(workspace => workspace.id === DEFAULT_WORKSPACE)).toBe(true)
  })
})
