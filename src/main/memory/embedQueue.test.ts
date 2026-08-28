import { describe, expect, it, vi } from 'vitest'
import { createEmbedQueue, type EmbedProgress, type VectorHolder } from './embedQueue'
import type { Embedder } from './embedder'
import type { MemoryVector, PendingVector } from './vectors'

const pendingOf = (id: string): PendingVector => ({ id, text: `about ${id}`, digest: `d_${id}` })

/** The index, as the queue sees it: a list that shrinks as vectors are written back into it. */
function fakeHolder(ids: readonly string[]): VectorHolder & {
  written: MemoryVector[]
  dropped: string[]
} {
  const waiting = [...ids]
  const written: MemoryVector[] = []
  const dropped: string[] = []

  return {
    written,
    dropped,
    pendingVectors: async () => waiting.length,
    withoutVector: async (_model, limit) => waiting.slice(0, limit).map(pendingOf),
    writeVectors: async vectors => {
      written.push(...vectors)
      for (const one of vectors) waiting.splice(waiting.indexOf(one.memoryId), 1)
    },
    dropOtherVectors: async model => {
      dropped.push(model)
    },
  }
}

function fakeEmbedder(model: string | null, answer?: Embedder['embed']): Embedder {
  return {
    chosen: () => model,
    embed: answer ?? (async texts => texts.map(() => new Float32Array([1, 0]))),
    embedQuery: async () => new Float32Array([1, 0]),
    close: async () => {},
  }
}

function queueOn(
  embedder: Embedder,
  batch = 2,
): { run: ReturnType<typeof createEmbedQueue>; steps: EmbedProgress[]; troubles: string[] } {
  const steps: EmbedProgress[] = []
  const troubles: string[] = []

  return {
    steps,
    troubles,
    run: createEmbedQueue({
      embedder,
      batch,
      onProgress: step => steps.push(step),
      onTrouble: message => troubles.push(message),
    }),
  }
}

describe('bringing an index up to date', () => {
  it('writes one vector per memory that had none', async () => {
    const holder = fakeHolder(['m_a', 'm_b', 'm_c'])
    const { run } = queueOn(fakeEmbedder('gemma'))

    await expect(run.run(holder)).resolves.toBe(3)
    expect(holder.written.map(one => one.memoryId)).toEqual(['m_a', 'm_b', 'm_c'])
  })

  /** The digest is what ties a vector to the words it was made from — see `digestOf`. */
  it('files each vector under the digest the index handed over', async () => {
    const holder = fakeHolder(['m_a'])
    const { run } = queueOn(fakeEmbedder('gemma'))
    await run.run(holder)

    expect(holder.written[0]).toMatchObject({ model: 'gemma', digest: 'd_m_a' })
  })

  it('reports how far it has got, from nothing done to everything', async () => {
    const holder = fakeHolder(['m_a', 'm_b', 'm_c'])
    const { run, steps } = queueOn(fakeEmbedder('gemma'))
    await run.run(holder)

    expect(steps).toEqual([
      { done: 0, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ])
  })

  /** Dead weight from another model, scored against questions it cannot answer. */
  it('drops what another model left behind before it counts anything', async () => {
    const holder = fakeHolder([])
    const { run } = queueOn(fakeEmbedder('gemma'))
    await run.run(holder)

    expect(holder.dropped).toEqual(['gemma'])
  })

  /**
   * 🛑 A `model <> ?` cannot use the `(model, text_digest)` index, so it is a full scan of the
   * vector table — and `catchUp` fires on EVERY remembered action, not when the model changes.
   */
  it('sweeps once for a model, however many runs it is given', async () => {
    const holder = fakeHolder([])
    const { run } = queueOn(fakeEmbedder('gemma'))

    await run.run(holder)
    await run.run(holder)
    await run.run(holder)

    expect(holder.dropped).toEqual(['gemma'])
  })

  it('does nothing at all when no model is chosen', async () => {
    const holder = fakeHolder(['m_a'])
    const { run, steps } = queueOn(fakeEmbedder(null))

    await expect(run.run(holder)).resolves.toBe(0)
    expect(holder.written).toEqual([])
    expect(steps).toEqual([])
  })
})

describe('stopping', () => {
  /**
   * 🛑 The signal must reach the PROCESS. Kept between batches only, the whole cancel path —
   * the abort listener, the worker's `dropped` set — is unreachable in production.
   */
  it('hands the signal down to the embedder', async () => {
    const holder = fakeHolder(['m_a'])
    const stop = new AbortController()
    const seen: (AbortSignal | undefined)[] = []
    const { run } = queueOn(
      fakeEmbedder('gemma', async (texts, signal) => {
        seen.push(signal)
        return texts.map(() => new Float32Array([1, 0]))
      }),
    )

    await run.run(holder, stop.signal)

    expect(seen).toEqual([stop.signal])
  })

  it('stops between batches when the signal is raised', async () => {
    const holder = fakeHolder(['m_a', 'm_b', 'm_c', 'm_d'])
    const stop = new AbortController()
    const { run } = queueOn(
      fakeEmbedder('gemma', async texts => {
        stop.abort()
        return texts.map(() => new Float32Array([1, 0]))
      }),
    )

    await expect(run.run(holder, stop.signal)).resolves.toBe(2)
    expect(holder.written).toHaveLength(2)
  })

  /**
   * 🛑 Two runs would read the same page of pending memories and hand both of them to the one
   * process — the same memory embedded twice, and the second write over the first.
   */
  it('joins the run already going rather than starting a second', async () => {
    const holder = fakeHolder(['m_a', 'm_b'])
    const embed = vi.fn(async (texts: readonly string[]) =>
      texts.map(() => new Float32Array([1, 0])),
    )
    const { run } = queueOn(fakeEmbedder('gemma', embed))

    const [one, other] = await Promise.all([run.run(holder), run.run(holder)])

    expect([one, other]).toEqual([2, 2])
    expect(embed).toHaveBeenCalledTimes(1)
  })

  /**
   * Writing the first few against the wrong memories is worse than writing none: the index would
   * hold a vector of one memory filed under another, and nothing would ever say so.
   */
  it('stops rather than misfiling when fewer vectors come back than texts', async () => {
    const holder = fakeHolder(['m_a', 'm_b'])
    const { run, troubles } = queueOn(fakeEmbedder('gemma', async () => [new Float32Array([1, 0])]))

    await expect(run.run(holder)).resolves.toBe(0)
    expect(holder.written).toEqual([])
    expect(troubles).toHaveLength(1)
  })

  it('keeps what it wrote when a batch throws', async () => {
    const holder = fakeHolder(['m_a', 'm_b', 'm_c'])
    let batches = 0
    const { run, troubles } = queueOn(
      fakeEmbedder('gemma', async texts => {
        if (batches++ > 0) throw new Error('out of memory')
        return texts.map(() => new Float32Array([1, 0]))
      }),
    )

    await expect(run.run(holder)).resolves.toBe(0)
    expect(holder.written).toHaveLength(2)
    expect(troubles).toEqual(['out of memory'])
  })
})

describe('what is left to do', () => {
  it('counts without starting anything', async () => {
    const holder = fakeHolder(['m_a', 'm_b'])
    const { run } = queueOn(fakeEmbedder('gemma'))

    await expect(run.pending(holder)).resolves.toBe(2)
    expect(holder.written).toEqual([])
  })

  it('counts nothing when no model is chosen', async () => {
    const { run } = queueOn(fakeEmbedder(null))

    await expect(run.pending(fakeHolder(['m_a']))).resolves.toBe(0)
  })
})
