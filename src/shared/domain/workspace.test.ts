import { describe, expect, it } from 'vitest'
import {
  canMoveWorkspace,
  movedWorkspace,
  movedWorkspaceBy,
  WORKSPACE_IDS,
  workspaceOrder,
  type WorkspaceId,
} from './workspace'

describe('workspaceOrder', () => {
  it('keeps the registry order when nothing was stored', () => {
    expect(workspaceOrder([])).toEqual([...WORKSPACE_IDS])
  })

  it('keeps what the user arranged', () => {
    const stored: WorkspaceId[] = ['image', 'video', '3d', 'code', 'audio', 'materials', 'skyboxes']
    stored.reverse()

    expect(workspaceOrder(stored)).toEqual(stored)
  })

  /**
   * A stored order is a photograph of the workspaces that existed the day it was written, and the
   * registry will grow again: a build that adds one must show it, rather than hide it from
   * everyone who had already arranged the bar.
   */
  it('adds a workspace the stored order predates, next to the neighbours it was declared with', () => {
    const withoutLast = WORKSPACE_IDS.filter(id => id !== 'skyboxes')

    expect(workspaceOrder(withoutLast)).toEqual([...WORKSPACE_IDS])
  })

  it('places a newcomer after the space it follows in the registry, wherever that space was moved', () => {
    // `skyboxes` is declared after `textures`, so it lands there — even when `textures` opens the
    // bar.
    expect(workspaceOrder(['materials', 'image'])).toEqual([
      'materials',
      'skyboxes',
      'image',
      'video',
      '3d',
      'code',
      'audio',
    ])
  })

  it('drops an id no build declares any more rather than drawing a hole', () => {
    const stored: string[] = ['image', 'nether', 'video']

    expect(workspaceOrder(stored)).not.toContain('nether')
  })

  // The value comes off a file or an IPC message, so "an array" is a promise nobody made. The
  // function documents itself as the last guard; a window that blanks on `undefined` is not one.
  it('falls back to the registry when what it was given is not a list', () => {
    expect(workspaceOrder(undefined)).toEqual([...WORKSPACE_IDS])
    expect(workspaceOrder('image')).toEqual([...WORKSPACE_IDS])
    expect(workspaceOrder(null)).toEqual([...WORKSPACE_IDS])
  })

  it('answers with every workspace exactly once, whatever it was given', () => {
    const order = workspaceOrder(['skyboxes', 'skyboxes', 'image'])

    expect(order).toHaveLength(WORKSPACE_IDS.length)
    expect(new Set(order).size).toBe(WORKSPACE_IDS.length)
  })
})

describe('movedWorkspace', () => {
  const bar: WorkspaceId[] = ['image', 'video', '3d', 'audio']

  // Dropping on a space means taking its place: the one released rightwards lands after the
  // target, the one released leftwards before it. Same rule, read from either side.
  it('lands after the target when dragged rightwards', () => {
    expect(movedWorkspace(bar, 'image', '3d')).toEqual(['video', '3d', 'image', 'audio'])
  })

  it('lands before the target when dragged leftwards', () => {
    expect(movedWorkspace(bar, 'audio', 'image')).toEqual(['audio', 'image', 'video', '3d'])
  })

  it('reaches the end of the bar', () => {
    expect(movedWorkspace(bar, 'image', 'audio')).toEqual(['video', '3d', 'audio', 'image'])
  })

  // A drag released on the space it started from is not a write that quietly does nothing.
  it('changes nothing when a space is dropped on itself', () => {
    expect(movedWorkspace(bar, 'video', 'video')).toEqual(bar)
  })

  it('changes nothing when either end of the move is unknown', () => {
    expect(movedWorkspace(bar, 'image', 'skyboxes')).toEqual(bar)
    expect(movedWorkspace(bar, 'skyboxes', 'image')).toEqual(bar)
  })

  it('leaves the order it was given untouched', () => {
    const given: WorkspaceId[] = ['image', 'video', '3d', 'audio']
    movedWorkspace(given, 'image', 'audio')

    expect(given).toEqual(['image', 'video', '3d', 'audio'])
  })
})

describe('movedWorkspaceBy', () => {
  const bar = (): WorkspaceId[] => [...WORKSPACE_IDS]

  it('walks one place towards the head of the bar', () => {
    expect(movedWorkspaceBy(bar(), 'video', 'left')[0]).toBe('video')
  })

  it('walks one place towards the tail', () => {
    expect(movedWorkspaceBy(bar(), 'image', 'right')[1]).toBe('image')
  })

  // Unchanged at either end, so the menu row is disabled rather than a write that does nothing.
  it('stays put at the ends, and says so beforehand', () => {
    expect(canMoveWorkspace(bar(), 'image', 'left')).toBe(false)
    expect(canMoveWorkspace(bar(), 'skyboxes', 'right')).toBe(false)
    expect(movedWorkspaceBy(bar(), 'image', 'left')).toEqual(bar())
  })

  it('offers the move everywhere else', () => {
    expect(canMoveWorkspace(bar(), 'image', 'right')).toBe(true)
    expect(canMoveWorkspace(bar(), 'skyboxes', 'left')).toBe(true)
  })

  it('reconciles what it was given, like everything else that reads a stored order', () => {
    expect(movedWorkspaceBy(undefined, 'image', 'right')[1]).toBe('image')
  })
})
