import type { BvhRequest, BvhResponse, SerializedBvh } from './bvhMessage'

/**
 * The requests on their way to the BVH worker, and the promises waiting on them.
 *
 * Its own module rather than a map inside the builder, for the reason `framingPlacement` left
 * `frameSelection`: a register nothing outside can read is a register nothing can measure. The
 * builder's `finally` that swept it after a failed send was an assurance no test could reach —
 * `size` is what makes the same rule a measurement.
 *
 * The studio holds three registers of this shape — `catalogClient.ts`, `peaks-client.ts`,
 * `stt-client.ts` — and none of them is shared with this one: they live in the main process,
 * which the renderer cannot import, and `shared/` carries no runtime code.
 */
export type InflightBuilds = {
  /**
   * Sends a request and waits for its answer. `null` means the register was let go while the
   * build was still out — an awaited promise nobody answers never ends.
   *
   * Everything but the id: numbering is the register's, so no caller can hand out one of its own.
   */
  send: (worker: Worker, request: Omit<BvhRequest, 'id'>) => Promise<SerializedBvh | null>
  /** The worker answered. An id nothing waits on is a late answer, and is dropped. */
  settle: (response: BvhResponse) => void
  /** The worker answers nothing more: everyone waiting on it hears why. */
  failAll: (reason: string) => void
  /** The engine is going. Resolved, not rejected: a window closing is nobody's failure. */
  resolveAll: () => void
  /** How many requests are out. Zero once every one of them has been answered for. */
  readonly size: number
}

export function createInflightBuilds(): InflightBuilds {
  const waiting = new Map<number, Settle>()
  let nextId = 0

  return {
    send: (worker, payload) =>
      new Promise<SerializedBvh | null>((resolve, reject) => {
        const request = { ...payload, id: (nextId += 1) }
        // Sent before it is recorded, so a payload the structured clone cannot carry throws with
        // no slot left behind. Safe in this order because a worker cannot answer during
        // `postMessage` — measured in Chromium, its events are always a turn later.
        worker.postMessage(request, transferablesOf(request))
        waiting.set(request.id, { resolve, reject })
      }),

    settle: response => {
      const slot = waiting.get(response.id)
      waiting.delete(response.id)
      if (!slot) return
      if (response.ok) slot.resolve(response.bvh)
      else slot.reject(new Error(response.error))
    },

    failAll: reason => {
      for (const slot of waiting.values()) slot.reject(new Error(reason))
      waiting.clear()
    },

    resolveAll: () => {
      for (const slot of waiting.values()) slot.resolve(null)
      waiting.clear()
    },

    get size() {
      return waiting.size
    },
  }
}

type Settle = {
  resolve: (bvh: SerializedBvh | null) => void
  reject: (error: Error) => void
}

function transferablesOf(request: BvhRequest): Transferable[] {
  const buffers: Transferable[] = [request.position.buffer]
  if (request.index) buffers.push(request.index.buffer)
  return buffers
}
