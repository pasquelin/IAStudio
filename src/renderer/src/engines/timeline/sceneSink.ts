import { DEFAULT_CLIP } from '@shared/domain/scene'
import { secondsToUs } from '@shared/domain/time'
import { createDefaultScene } from '../scene/defaultScene'
import { modelNode } from '../scene/nodeFactory'
import type { SceneState } from '../scene/sceneState'
import type { SceneStage } from '../scene/sceneStage'
import type { SinkLike } from './decoderPool'

/**
 * A scene built around one model, for a `.glb` dropped straight onto a montage.
 *
 * Lit like a new document rather than left bare: an unlit model is a black silhouette, and
 * someone who dragged a model onto a track expects to see the model. No camera either — the
 * stage aims the free one at whatever the file turned out to hold, which is the only sensible
 * framing for a file nobody has composed a shot around.
 */
export type ModelScene = {
  read: () => SceneState
  /**
   * The clips the file turned out to carry, once it has landed. The first one is played: a model
   * exported with an animation is a model meant to move, and a montage that showed it frozen
   * would look like the import failed.
   */
  useClips: (nodeId: string, clips: readonly string[]) => void
}

export function createModelScene(assetId: string, name: string): ModelScene {
  const model = modelNode(assetId, name)
  const base = createDefaultScene()
  let state: SceneState = { ...base, nodes: [...base.nodes, model] }

  return {
    read: () => state,
    useClips: (nodeId, clips) => {
      const clip = clips[0]
      if (nodeId !== model.id || !clip) return

      // A new object, never a field written in place: the stage decides it has something to do
      // by comparing references, and a mutation would be applied by nobody.
      state = {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === model.id && node.type === 'model'
            ? {
                ...node,
                model: {
                  ...node.model,
                  clips: [
                    {
                      ...DEFAULT_CLIP,
                      id: 'dropped',
                      source: { kind: 'embedded', name: clip },
                      label: clip,
                      playing: true,
                    },
                  ],
                },
              }
            : node,
        ),
      }
    },
  }
}

export type SceneSinkDeps = {
  /**
   * What to draw, read afresh on every frame. That re-read is the whole feature: a scene edited
   * in its own tab is a new state object here, and the very next frame of the montage shows it.
   *
   * `null` while a document's file is still being read — the sink then draws nothing rather than
   * an empty scene, so the montage keeps whatever was on screen instead of flashing to black.
   */
  read: () => SceneState | null
  stage: SceneStage
}

/**
 * A sink that renders 3D instead of decoding a file, so the montage cannot tell the two apart.
 *
 * The frame is taken inside `getSample`, on the same tick as the draw that produced it: a WebGL
 * drawing buffer is only guaranteed to hold its pixels until the task ends, and `toVideoFrame`
 * is called by the pool after an await — which is one tick too late.
 *
 * `holdsDecoder` is false and that is not a detail: it holds a WebGL context, which the pool
 * counts against pictures rather than against the two or four hardware decoders a GPU offers.
 */
export function createSceneSink({ read, stage }: SceneSinkDeps): SinkLike {
  return {
    getSample: async seconds => {
      const state = read()
      if (!state) return null

      stage.show(state)
      const canvas = stage.draw(secondsToUs(seconds))
      if (!canvas) return null

      const frame = new VideoFrame(canvas, { timestamp: Math.round(seconds * 1_000_000) })
      // Closed by whoever draws it, exactly as a still's is; closing it here would hand the
      // monitor a frame it can no longer read.
      return { toVideoFrame: () => frame, close: () => {} }
    },
    close: stage.dispose,
    holdsDecoder: false,
  }
}
