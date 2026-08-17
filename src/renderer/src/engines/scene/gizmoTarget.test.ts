import { Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { gizmoTargetFor, type TransformMode } from './gizmoTarget'
import type { SceneNodeType } from './sceneState'

/** An object standing for a node of that kind, named as the engine names them: by id. */
function object(id: string): Object3D {
  const made = new Object3D()
  made.name = id
  return made
}

const kinds = (types: Record<string, SceneNodeType>) => (candidate: Object3D) => {
  const type = types[candidate.name]
  return type ? { type } : undefined
}

describe('gizmoTargetFor', () => {
  const sprite = object('s')
  const mesh = object('m')
  const both = kinds({ s: 'sprite', m: 'mesh' })

  it('aims at nothing in select, which is the mode with no handle', () => {
    expect(gizmoTargetFor('select', 'world', [mesh], both)).toEqual({ kind: 'none' })
  })

  it('aims at nothing when nothing is selected', () => {
    expect(gizmoTargetFor('translate', 'world', [], both)).toEqual({ kind: 'none' })
  })

  /**
   * The defect: a rotate handle over a sprite wrote a rotation the shader never reads, so the
   * document changed, an undo was stacked, and the screen did not move.
   */
  it('refuses a rotate handle over a sprite alone', () => {
    expect(gizmoTargetFor('rotate', 'world', [sprite], both)).toEqual({ kind: 'none' })
  })

  // Moving and sizing a sprite both show — only turning it does not.
  const shows: TransformMode[] = ['translate', 'scale']

  it.each(shows)('still aims at a sprite in %s', mode => {
    expect(gizmoTargetFor(mode, 'world', [sprite], both)).toEqual({
      kind: 'object',
      object: sprite,
    })
  })

  /**
   * From two upwards the handle drives the pivot, and turning a pivot carries its children through
   * space — sprites included. The first cut refused the handle whenever nothing turned on its own,
   * which took it away from two sprites that a rotation would have moved.
   */
  it('keeps the rotate handle over two sprites, which a pivot would move', () => {
    const other = object('s2')
    const target = gizmoTargetFor(
      'rotate',
      'world',
      [sprite, other],
      kinds({ s: 'sprite', s2: 'sprite' }),
    )

    expect(target).toMatchObject({ kind: 'pivot', objects: [sprite, other] })
  })

  // Reparenting is offered by drag in the outliner, and three.js does turn a sprite's children.
  it('keeps the rotate handle over a sprite that other nodes hang from', () => {
    const parent = object('s3')
    parent.add(object('m2'))

    expect(gizmoTargetFor('rotate', 'world', [parent], kinds({ s3: 'sprite' }))).toEqual({
      kind: 'object',
      object: parent,
    })
  })

  // Turning the group carries the sprite through space, and that does show.
  it('keeps the rotate handle when something in the selection turns', () => {
    const target = gizmoTargetFor('rotate', 'world', [sprite, mesh], both)

    expect(target).toMatchObject({ kind: 'pivot', objects: [sprite, mesh] })
  })

  it('aims straight at a single object rather than through the pivot', () => {
    expect(gizmoTargetFor('rotate', 'world', [mesh], both)).toEqual({
      kind: 'object',
      object: mesh,
    })
  })

  // The handles line up with the last node picked; a group has no orientation of its own to offer.
  it('anchors the pivot on the last pick in the local frame', () => {
    const target = gizmoTargetFor('translate', 'local', [mesh, sprite], both)

    expect(target).toEqual({ kind: 'pivot', objects: [mesh, sprite], anchor: sprite })
  })

  it('anchors on nothing in the world frame', () => {
    const target = gizmoTargetFor('translate', 'world', [mesh, sprite], both)

    expect(target).toEqual({ kind: 'pivot', objects: [mesh, sprite], anchor: undefined })
  })

  // Withholding a handle over something the engine cannot name would be a gizmo that vanishes
  // for a reason nobody can see.
  it('keeps the rotate handle over an object it cannot name', () => {
    expect(gizmoTargetFor('rotate', 'world', [sprite], () => undefined)).toEqual({
      kind: 'object',
      object: sprite,
    })
  })
})
