import { describe, expect, it } from 'vitest'
import { kindForWorkspace } from './document'
import { WORKSPACE_IDS } from './workspace'

describe('kindForWorkspace', () => {
  it('gives the image workspace an image document', () => {
    expect(kindForWorkspace('image')).toBe('image')
  })

  it('gives the 3d workspace a scene document', () => {
    expect(kindForWorkspace('3d')).toBe('scene')
  })

  it('gives the video workspace a sequence document', () => {
    expect(kindForWorkspace('video')).toBe('sequence')
  })

  it('has no editable document for the workspaces without an editor yet', () => {
    expect(kindForWorkspace('audio')).toBeNull()
    expect(kindForWorkspace('textures')).toBeNull()
    expect(kindForWorkspace('skyboxes')).toBeNull()
  })

  it('answers for every known workspace', () => {
    for (const id of WORKSPACE_IDS) expect(() => kindForWorkspace(id)).not.toThrow()
  })
})
