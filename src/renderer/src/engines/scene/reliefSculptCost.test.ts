import { describe, expect, it } from 'vitest'
import {
  applyReliefSculpt,
  changedChunks,
  chunkLayout,
  packDeltas,
  unpackDeltas,
  withPackedChunks,
  type ReliefSculptOperation,
} from '@shared/domain/relief'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
} from '@shared/domain/scene'

const MAP = 1024

describe('relief sculpt cost', () => {
  it('leaves the disk loop off the UI thread: packing edits is the remainder', () => {
    const samples = { width: MAP, height: MAP, values: new Float32Array(MAP * MAP) }
    const extent = {
      origin: DEFAULT_RELIEF_ORIGIN,
      size: DEFAULT_RELIEF_SIZE,
      elevation: DEFAULT_RELIEF_ELEVATION,
    }
    const operation: ReliefSculptOperation = {
      kind: 'raiseDisk',
      disk: {
        x: extent.origin.x + extent.size.x / 2,
        z: extent.origin.z + extent.size.z / 2,
        radius: Math.hypot(extent.size.x, extent.size.z) / 2,
      },
      amount: 0.25,
    }

    const started = performance.now()
    const after = applyReliefSculpt(samples, extent, undefined, operation)
    const computeMs = performance.now() - started

    const edits = changedChunks(undefined, after)
    const transferred = edits.map(edit => {
      const layout = chunkLayout(edit.column, edit.row, MAP, MAP, after.grain)
      return {
        column: edit.column,
        row: edit.row,
        deltas: unpackDeltas(edit.payload, layout.width * layout.height),
      }
    })

    const applyStarted = performance.now()
    const packed = transferred.map(chunk => ({
      column: chunk.column,
      row: chunk.row,
      payload: packDeltas(chunk.deltas),
    }))
    withPackedChunks(undefined, after.grain, packed)
    const mainMs = performance.now() - applyStarted

    // 1024² full disk, 2026-09-03: compute 177 ms on the UI thread, pack/apply 94 ms after.
    expect(after.chunks.length).toBeGreaterThan(0)
    expect(mainMs).toBeLessThan(computeMs)
    expect(computeMs).toBeGreaterThan(1)
  })
})
