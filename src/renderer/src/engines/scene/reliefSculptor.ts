import {
  reliefChunkRowsInDisk,
  withPackedChunks,
  type PackedReliefChunk,
  type ReliefExtent,
  type ReliefSculpt,
} from '@shared/domain/relief'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { createWorkerSession } from '../core/workerSession'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'
import { evenRange } from '../core/evenRange'
import { workerPoolSize } from '../core/workerPoolSize'

export type ReliefDiskStroke = {
  samples: HeightmapSamples
  extent: ReliefExtent
  grain: number
  sculpt: ReliefSculpt | undefined
  disk: { x: number; z: number; radius: number }
  amount: number
  falloff?: number
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

const CHUNK_ROWS_PER_WORKER = 2

export function createReliefSculptor(
  spawn: () => Worker,
  maximumWorkers = workerPoolSize(),
): ReliefSculptor {
  const sessions = Array.from({ length: Math.max(1, Math.floor(maximumWorkers)) }, () =>
    createWorkerSession<ReliefSculptRequest, ReliefSculptResponse>(spawn),
  )
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
      const ranges = rowRanges(job, sessions.length)
      const responses = await Promise.all(
        ranges.map((rows, index) => {
          const session = sessions[index]
          if (!session) throw new Error('Relief sculpt worker is unavailable')
          return session.send({
            id: session.nextId(),
            width: job.samples.width,
            height: job.samples.height,
            extent: job.extent,
            grain: job.grain,
            sculpt:
              ranges.length === 1
                ? before
                : {
                    chunks:
                      before?.chunks.filter(
                        chunk => chunk.row >= rows.from && chunk.row < rows.to,
                      ) ?? [],
                  },
            operation: {
              kind: 'raiseDisk',
              disk: job.disk,
              amount: job.amount,
              falloff: job.falloff ?? 0,
            },
            rows: ranges.length === 1 ? undefined : rows,
          })
        }),
      )
      if (token !== generation) {
        job.resolve(null)
        return
      }
      const failed = responses.find(response => !response.ok)
      if (failed && !failed.ok) {
        job.reject(new Error(failed.error))
        return
      }
      const edits = responses.flatMap(response => (response.ok ? response.chunks : []))
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
      sessions.forEach(session => session.dispose())
    },
  }
}

function rowRanges(
  stroke: ReliefDiskStroke,
  maximumWorkers: number,
): { from: number; to: number }[] {
  const { from, to } = reliefChunkRowsInDisk(
    stroke.samples,
    stroke.extent,
    stroke.disk,
    stroke.grain,
  )
  const workers = Math.min(
    maximumWorkers,
    Math.max(1, Math.ceil((to - from) / CHUNK_ROWS_PER_WORKER)),
  )
  return Array.from({ length: workers }, (_, worker) => evenRange(to - from, workers, worker, from))
}

function sameSculpt(left: ReliefSculpt | undefined, right: ReliefSculpt | undefined): boolean {
  if (left === right) return true
  if (!left || !right || left.chunks.length !== right.chunks.length) {
    return false
  }
  const keys = new Set(left.chunks.map(chunk => `${chunk.column}:${chunk.row}:${chunk.payload}`))
  return right.chunks.every(chunk => keys.has(`${chunk.column}:${chunk.row}:${chunk.payload}`))
}
