import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, emptyHistory, run, undo } from '../core/history'
import { changedChunks, withChunkDelta, type ReliefSculpt } from '@shared/domain/relief'
import { DEFAULT_WORLD, reliefLayer, terrainEditLayer } from '@shared/domain/scene'
import { sculptRelief } from './reliefCommands'
import { EMPTY_SCENE, type SceneState } from './sceneState'

const samples = {
  width: 66,
  height: 8,
  values: new Float32Array(66 * 8),
}

function sceneOf(sculpt?: ReliefSculpt): SceneState {
  return {
    ...EMPTY_SCENE,
    world: {
      ...DEFAULT_WORLD,
      layers: [reliefLayer({ assetId: 'asset_height' }, { edits: [terrainEditLayer({ sculpt })] })],
    },
  }
}

function payload(state: SceneState, column: number, row: number): string {
  const layer = state.world.layers[0]
  if (!layer || layer.kind !== 'relief') return ''
  return (
    layer.edits[0]?.sculpt?.chunks.find(chunk => chunk.column === column && chunk.row === row)
      ?.payload ?? ''
  )
}

describe('sculptRelief', () => {
  it('undoes only the second chunk, leaving the first stroke applied', () => {
    const first = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 1,
      localZ: 0,
      delta: 2,
    })
    const second = withChunkDelta(samples, first, {
      column: 1,
      row: 0,
      localX: 0,
      localZ: 0,
      delta: 5,
    })

    const [afterFirst, history] = run(
      sceneOf(),
      emptyHistory(),
      sculptRelief('terrain', 'sculpt', changedChunks(undefined, first)),
    )
    const [afterSecond, stacked] = run(
      afterFirst,
      history,
      sculptRelief('terrain', 'sculpt', changedChunks(first, second)),
    )
    const [undone] = undo(afterSecond, stacked)

    expect(payload(afterSecond, 0, 0)).toBe(payload(afterFirst, 0, 0))
    expect(payload(afterSecond, 1, 0)).not.toBe('')
    expect(payload(undone, 0, 0)).toBe(payload(afterFirst, 0, 0))
    expect(payload(undone, 1, 0)).toBe('')
  })

  it('shares the scene stack: a hundred sculpt strokes drop the oldest scene edit', () => {
    let state = sceneOf()
    let history = emptyHistory<SceneState>()
    let sculpt: ReliefSculpt | undefined
    for (let at = 0; at < HISTORY_LIMIT + 1; at++) {
      const next = withChunkDelta(samples, sculpt, {
        column: 0,
        row: 0,
        localX: at % 8,
        localZ: 0,
        delta: 0.01,
      })
      ;[state, history] = run(
        state,
        history,
        sculptRelief('terrain', 'sculpt', changedChunks(sculpt, next)),
      )
      sculpt = next
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    expect(history.dropped).not.toBeNull()
  })
})
