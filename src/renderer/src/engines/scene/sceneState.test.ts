import { describe, expect, it } from 'vitest'
import { DEFAULT_CLIP, type ClipRef } from '@shared/domain/scene'
import {
  lightNodeFixture as light,
  meshNode as mesh,
  modelNodeFixture as model,
  spriteNodeFixture as sprite,
} from './scene-fixtures'
import {
  canReparent,
  childrenOf,
  EMPTY_SCENE,
  firstCameraId,
  hasChildren,
  nodeById,
  rotationShows,
  sceneWithoutSelfPlay,
  selectedNodes,
  subtreeOf,
  type SceneState,
} from './sceneState'

describe('EMPTY_SCENE', () => {
  it('starts empty with nothing selected', () => {
    expect(EMPTY_SCENE.nodes).toHaveLength(0)
    expect(EMPTY_SCENE.selectedIds).toEqual([])
  })
})

describe('firstCameraId', () => {
  it('answers the first camera in document order, and nothing for a scene without one', () => {
    expect(firstCameraId([mesh('a'), light('b')])).toBeNull()
  })
})

describe('sceneWithoutSelfPlay', () => {
  const walkBlock = (playing: boolean): ClipRef => ({
    ...DEFAULT_CLIP,
    id: 'c1',
    source: { kind: 'embedded', name: 'Walk' },
    label: 'Walk',
    playing,
  })

  const playing = (state: boolean): SceneState => {
    const node = model('m')
    return {
      ...EMPTY_SCENE,
      nodes: [
        {
          ...node,
          model: {
            ...node.model,
            clips: [walkBlock(state)],
          },
        },
      ],
    }
  }

  it('stops a model its own tab left running, so the playhead alone decides the pose', () => {
    const stopped = sceneWithoutSelfPlay(playing(true)).nodes[0]

    expect(stopped?.type === 'model' ? stopped.model.clips?.[0]?.playing : null).toBe(false)
  })

  it('keeps which clip is bound: stopping is not unbinding', () => {
    const stopped = sceneWithoutSelfPlay(playing(true)).nodes[0]

    expect(stopped?.type === 'model' ? stopped.model.clips?.[0]?.source.name : null).toBe('Walk')
  })

  it('hands the very same object back when nothing was playing', () => {
    const paused = playing(false)

    expect(sceneWithoutSelfPlay(paused)).toBe(paused)
    expect(sceneWithoutSelfPlay(EMPTY_SCENE)).toBe(EMPTY_SCENE)
  })
})

describe('nodeById', () => {
  it('finds a node by its id', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), light('b')], selectedIds: [] }
    expect(nodeById(state, 'b')?.type).toBe('light')
  })

  it('returns null for an unknown id', () => {
    expect(nodeById({ ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }, 'ghost')).toBeNull()
  })
})

describe('selectedNodes', () => {
  const nodes = [mesh('a'), mesh('b'), mesh('c')]

  it('is nothing when nothing is selected', () => {
    expect(selectedNodes(nodes, [])).toEqual([])
  })

  it('keeps the order the selection was built in, so the last one is the anchor', () => {
    expect(selectedNodes(nodes, ['c', 'a']).map(node => node.id)).toEqual(['c', 'a'])
    expect(selectedNodes(nodes, ['c', 'a']).at(-1)?.id).toBe('a')
  })

  it('drops the ids nothing answers to rather than reporting holes', () => {
    expect(selectedNodes(nodes, ['a', 'ghost']).map(node => node.id)).toEqual(['a'])
  })
})

/** The classic bug of reparenting: a tree closed on itself, and every walk of it runs forever. */
describe('canReparent', () => {
  // a > b > c
  const nodes = [mesh('a'), mesh('b', 'a'), mesh('c', 'b')]

  it('lets a node hang from an unrelated one, and from the scene', () => {
    expect(canReparent(nodes, 'c', null)).toBe(true)
    expect(canReparent([mesh('a'), mesh('b')], 'a', 'b')).toBe(true)
  })

  it('refuses a node under itself', () => {
    expect(canReparent(nodes, 'a', 'a')).toBe(false)
  })

  it('refuses a node under its own child', () => {
    expect(canReparent(nodes, 'a', 'b')).toBe(false)
  })

  it('refuses a node under a deeper descendant, not only a direct child', () => {
    expect(canReparent(nodes, 'a', 'c')).toBe(false)
  })

  it('answers rather than looping when the tree already holds a cycle', () => {
    const looped = [mesh('a', 'b'), mesh('b', 'a')]
    expect(canReparent(looped, 'a', 'b')).toBe(false)
  })
})

describe('subtreeOf', () => {
  const nodes = [mesh('a'), mesh('b', 'a'), mesh('c', 'b'), mesh('d')]

  it('carries a node and everything under it, however deep', () => {
    expect(subtreeOf(nodes, 'a').map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('is the node alone when nothing hangs from it', () => {
    expect(subtreeOf(nodes, 'd').map(node => node.id)).toEqual(['d'])
  })

  it('leaves the branches beside it alone', () => {
    expect(subtreeOf(nodes, 'b').map(node => node.id)).toEqual(['b', 'c'])
  })

  /**
   * Reparenting changes a `parentId` in place, so a child can perfectly well be listed before
   * the parent it now hangs from. Reading the array in order left those behind — nodes nothing
   * showed any more, that no delete could reach, and that the file kept.
   */
  it('finds a branch whose child is declared before its parent', () => {
    const jumbled = [mesh('c', 'a'), mesh('a', 'b'), mesh('b')]
    expect(
      subtreeOf(jumbled, 'b')
        .map(node => node.id)
        .sort(),
    ).toEqual(['a', 'b', 'c'])
  })
})

describe('childrenOf', () => {
  it('keeps the declared order', () => {
    const state: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b'), mesh('c')],
      selectedIds: [],
    }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a', 'b', 'c'])
  })

  it('separates roots from children', () => {
    const state: SceneState = {
      ...EMPTY_SCENE,
      nodes: [mesh('a'), mesh('b', 'a')],
      selectedIds: [],
    }
    expect(childrenOf(state, null).map(node => node.id)).toEqual(['a'])
    expect(childrenOf(state, 'a').map(node => node.id)).toEqual(['b'])
  })

  it('answers with nothing for a childless parent', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: [] }
    expect(childrenOf(state, 'a')).toEqual([])
  })
})

describe('hasChildren', () => {
  it('answers on what hangs from the node, not on what the node hangs from', () => {
    const nodes = [mesh('a'), mesh('b', 'a')]
    expect(hasChildren(nodes, 'a')).toBe(true)
    expect(hasChildren(nodes, 'b')).toBe(false)
  })
})

/**
 * The rule three places have to agree on: the handle in the viewport, the row in the inspector,
 * and the command that writes the angle. It lives here so none of them can hold half of it.
 */
describe('rotationShows', () => {
  const none = () => false
  const some = () => true

  it('shows for anything but a sprite', () => {
    expect(rotationShows(mesh('a'), none)).toBe(true)
    expect(rotationShows(light('a'), none)).toBe(true)
  })

  // three.js reads a sprite's size off the lengths of the first two columns of the model matrix,
  // which a rotation leaves untouched, and takes its angle from a material uniform.
  it('shows nothing for a sprite with nothing under it', () => {
    expect(rotationShows(sprite('s'), none)).toBe(false)
  })

  it('shows for a sprite others hang from, which turning swings around it', () => {
    expect(rotationShows(sprite('s'), some)).toBe(true)
  })

  // Every caller is on a drag path, and walking a scene to answer for a cube would be waste.
  it('never asks for the children of a node its type already answers for', () => {
    let asked = 0
    rotationShows(mesh('a'), () => (asked += 1) > 0)
    expect(asked).toBe(0)

    rotationShows(sprite('s'), () => (asked += 1) > 0)
    expect(asked).toBe(1)
  })
})
