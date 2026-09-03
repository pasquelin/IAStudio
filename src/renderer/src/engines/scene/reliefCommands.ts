/**
 * Sculpt history: apply/revert swap packed deltas of the touched chunks, never a copy of the
 * heightfield. Shares the scene stack — HISTORY_LIMIT = 100 will drop older scene edits.
 */
import {
  RELIEF_CHUNK_TEXELS,
  chunkPayload,
  withPackedChunks,
  type PackedReliefChunk,
  type ReliefSculpt,
} from '@shared/domain/relief'
import type { Command } from '../core/history'
import type { SceneState } from './sceneState'

export function sculptRelief(
  layerAt: number,
  edits: readonly PackedReliefChunk[],
): Command<SceneState> {
  let previous: PackedReliefChunk[] | null = null

  return {
    id: `world:layers:${layerAt}:sculpt`,
    apply: state => {
      const layer = state.world.layers[layerAt]
      if (!layer || layer.kind !== 'relief') return state
      previous = edits.map(edit => ({
        column: edit.column,
        row: edit.row,
        payload: chunkPayload(layer.sculpt, edit.column, edit.row),
      }))
      return withSculpt(
        state,
        layerAt,
        withPackedChunks(layer.sculpt, grainOf(layer.sculpt), edits),
      )
    },
    revert: state => {
      const layer = state.world.layers[layerAt]
      if (!layer || layer.kind !== 'relief' || !previous) return state
      return withSculpt(
        state,
        layerAt,
        withPackedChunks(layer.sculpt, grainOf(layer.sculpt), previous),
      )
    },
    refuses: state => {
      const layer = state.world.layers[layerAt]
      if (!layer || layer.kind !== 'relief') return true
      return edits.every(edit => chunkPayload(layer.sculpt, edit.column, edit.row) === edit.payload)
    },
  }
}

function grainOf(sculpt: ReliefSculpt | undefined): number {
  return sculpt?.grain ?? RELIEF_CHUNK_TEXELS
}

function withSculpt(state: SceneState, layerAt: number, sculpt: ReliefSculpt): SceneState {
  const layers = state.world.layers.map((layer, at) => {
    if (at !== layerAt || layer.kind !== 'relief') return layer
    return sculpt.chunks.length === 0 ? { ...layer, sculpt: undefined } : { ...layer, sculpt }
  })
  return { ...state, world: { ...state.world, layers } }
}
