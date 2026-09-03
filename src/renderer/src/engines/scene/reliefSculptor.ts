import {
  withPackedChunks,
  type PackedReliefChunk,
  type ReliefExtent,
  type ReliefSculpt,
} from '@shared/domain/relief'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { createWorkerSession } from '../core/workerSession'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'

export type ReliefDiskStroke = {
  samples: HeightmapSamples
  extent: ReliefExtent
  grain: number
  sculpt: ReliefSculpt | undefined
  disk: { x: number; z: number; radius: number }
  amount: number
}

export type ReliefSculptor = {
  /** Queued, never coalesced: each disk ADDS, and dropping an in-between stroke would skip terrain. */
  raiseDisk: (stroke: ReliefDiskStroke) => Promise<PackedReliefChunk[] | null>
  /**
   * An outside write (undo, reload). Drops the queue and the in-flight answer so a late worker
   * cannot paint over the sculpt the user just restored.
   */
  note: (sculpt: ReliefSculpt | undefined) => void
  dispose: () => void
}

type Job = ReliefDiskStroke & {
  resolve: (edits: PackedReliefChunk[] | null) => void
  reject: (error: Error) => void
}

export function createReliefSculptor(spawn: () => Worker): ReliefSculptor {
  const session = createWorkerSession<ReliefSculptRequest, ReliefSculptResponse>(spawn)
  const queue: Job[] = []
  let generation = 0
  let bound: ReliefSculpt | undefined
  let heldAfter: ReliefSculpt | undefined
  let busy = false

  const dropQueue = (): void => {
    for (const job of queue) job.resolve(null)
    queue.length = 0
  }

  const invalidate = (): void => {
    generation += 1
    heldAfter = undefined
    dropQueue()
  }

  const pump = async (): Promise<void> => {
    if (busy) return
    const job = queue.shift()
    if (!job) return

    busy = true
    const token = generation
    const before = heldAfter ?? job.sculpt
    try {
      const response = await session.send({
        id: session.nextId(),
        width: job.samples.width,
        height: job.samples.height,
        extent: job.extent,
        grain: job.grain,
        sculpt: before,
        operation: { kind: 'raiseDisk', disk: job.disk, amount: job.amount },
      })
      if (token !== generation) {
        job.resolve(null)
        return
      }
      if (!response.ok) {
        job.reject(new Error(response.error))
        return
      }
      const edits = response.chunks
      heldAfter = withPackedChunks(before, edits)
      bound = heldAfter
      job.resolve(edits)
    } catch (error) {
      if (token !== generation) job.resolve(null)
      else job.reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      busy = false
      void pump()
    }
  }

  return {
    raiseDisk: stroke =>
      new Promise((resolve, reject) => {
        queue.push({ ...stroke, resolve, reject })
        void pump()
      }),
    note: sculpt => {
      if (sameSculpt(sculpt, heldAfter)) {
        bound = sculpt
        return
      }
      if (sameSculpt(sculpt, bound)) return
      invalidate()
      bound = sculpt
    },
    dispose: () => {
      invalidate()
      session.dispose()
    },
  }
}

function sameSculpt(left: ReliefSculpt | undefined, right: ReliefSculpt | undefined): boolean {
  if (left === right) return true
  if (!left || !right || left.chunks.length !== right.chunks.length) {
    return false
  }
  const keys = new Set(left.chunks.map(chunk => `${chunk.column}:${chunk.row}:${chunk.payload}`))
  return right.chunks.every(chunk => keys.has(`${chunk.column}:${chunk.row}:${chunk.payload}`))
}
