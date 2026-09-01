import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { scenePayloadOf } from '@/features/shell/sceneDocument'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { loadSceneSource, montageSceneOf } from './sceneSources'

const SCENE = 'scene-1'

/**
 * What the studio actually WRITES for a scene holding one mesh — a glTF document, its own state
 * riding in `extras`. The internal payload instead is the shape that made this test green while
 * a montage went on drawing an empty scene.
 */
const onDisk = (): string =>
  JSON.stringify(
    scenePayloadOf({ ...EMPTY_SCENE, nodes: [meshNode('box-1')], selectedIds: [] }, SCENE),
  )

describe('the scenes a montage draws whose document is not open', () => {
  beforeEach(() => {
    installFakeBridge({
      documents: {
        read: () =>
          Promise.resolve({
            id: SCENE,
            kind: 'scene',
            version: 1,
            title: 'Repérage',
            updatedAt: '2026-08-26T10:00:00.000Z',
            content: onDisk(),
          }),
      },
    })
  })

  /**
   * Two ways to read this wrong, and both answer the EMPTY scene rather than failing: the text of
   * `DocumentFile.content` handed straight to a reader that wants an object, and the parsed glTF
   * handed to the reader of the studio's own shape — whose `nodes` are the glTF's, none of them
   * ours. A clip naming a scene nobody had opened drew nothing, and an empty scene is legal.
   */
  it('reads a scene nobody has opened off its file, nodes and all', async () => {
    await loadSceneSource(SCENE)

    expect(montageSceneOf(SCENE)?.nodes.map(node => node.id)).toEqual(['box-1'])
  })
})
