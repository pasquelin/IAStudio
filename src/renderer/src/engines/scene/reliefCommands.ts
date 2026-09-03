/**
 * Sculpt history: apply/revert swap packed deltas of the touched chunks, never a copy of the
 * heightfield. Shares the scene stack — HISTORY_LIMIT = 100 will drop older scene edits.
 */
import { chunkPayload, withPackedChunks, type PackedReliefChunk } from '@shared/domain/relief'
import type { ReliefLayer, TerrainEditLayer } from '@shared/domain/scene'
import type { Command } from '../core/history'
import type { SceneState } from './sceneState'

export function sculptRelief(
  terrainId: string,
  editId: string,
  edits: readonly PackedReliefChunk[],
): Command<SceneState> {
  let previous: PackedReliefChunk[] | null = null

  return {
    id: `world:layers:${terrainId}:edits:${editId}:sculpt`,
    apply: state => {
      const target = targetedEdit(state, terrainId, editId)
      if (!target) return state
      previous = edits.map(edit => ({
        column: edit.column,
        row: edit.row,
        payload: chunkPayload(target.edit.sculpt, edit.column, edit.row),
      }))
      return withEditSculpt(state, terrainId, editId, withPackedChunks(target.edit.sculpt, edits))
    },
    revert: state => {
      const target = targetedEdit(state, terrainId, editId)
      if (!target || !previous) return state
      return withEditSculpt(
        state,
        terrainId,
        editId,
        withPackedChunks(target.edit.sculpt, previous),
      )
    },
    refuses: state => {
      const target = targetedEdit(state, terrainId, editId)
      if (!target || target.terrain.locked.sculpt || target.edit.locked) return true
      return edits.every(
        edit => chunkPayload(target.edit.sculpt, edit.column, edit.row) === edit.payload,
      )
    },
  }
}

function targetedEdit(
  state: SceneState,
  terrainId: string,
  editId: string,
): { terrain: ReliefLayer; edit: TerrainEditLayer } | undefined {
  const terrain = state.world.layers.find(
    (layer): layer is ReliefLayer => layer.kind === 'relief' && layer.id === terrainId,
  )
  const edit = terrain?.edits.find(one => one.id === editId)
  return terrain && edit ? { terrain, edit } : undefined
}

function withEditSculpt(
  state: SceneState,
  terrainId: string,
  editId: string,
  sculpt: ReturnType<typeof withPackedChunks>,
): SceneState {
  const layers = state.world.layers.map(layer => {
    if (layer.kind !== 'relief' || layer.id !== terrainId) return layer
    return {
      ...layer,
      edits: layer.edits.map(edit => {
        if (edit.id !== editId) return edit
        if (sculpt.chunks.length === 0) {
          return {
            id: edit.id,
            name: edit.name,
            enabled: edit.enabled,
            locked: edit.locked,
            alpha: edit.alpha,
          }
        }
        return { ...edit, sculpt }
      }),
    }
  })
  return { ...state, world: { ...state.world, layers } }
}
