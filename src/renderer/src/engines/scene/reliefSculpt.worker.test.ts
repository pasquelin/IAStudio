import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyReliefSculpt, changedChunks, type ReliefSculpt } from '@shared/domain/relief'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
} from '@shared/domain/scene'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'

const posted: unknown[][] = []

beforeAll(async () => {
  vi.spyOn(self, 'postMessage').mockImplementation((...args: unknown[]) => {
    posted.push(args)
  })
  await import('./reliefSculpt.worker')
})

beforeEach(() => {
  posted.length = 0
})

const samples = { width: 66, height: 8, values: new Float32Array(66 * 8) }
const extent = {
  origin: DEFAULT_RELIEF_ORIGIN,
  size: DEFAULT_RELIEF_SIZE,
  elevation: DEFAULT_RELIEF_ELEVATION,
}
const stepX = extent.size.x / (samples.width - 1)
const disk = {
  x: extent.origin.x + 64 * stepX,
  z: extent.origin.z,
  radius: stepX * 2,
}

function ask(id: number, sculpt: ReliefSculpt | undefined = undefined): void {
  const data: ReliefSculptRequest = {
    id,
    width: samples.width,
    height: samples.height,
    extent,
    sculpt,
    operation: { kind: 'raiseDisk', disk, amount: 3 },
  }
  self.dispatchEvent(new MessageEvent('message', { data }))
}

function packedOf(response: Extract<ReliefSculptResponse, { ok: true }>): ReliefSculpt {
  return { grain: response.grain, chunks: response.chunks }
}

describe('the relief sculpt worker', () => {
  it('answers the same deltas as applyReliefSculpt on this thread', () => {
    ask(4)

    const message = posted[0]?.[0] as ReliefSculptResponse
    expect(message).toMatchObject({ id: 4, ok: true })
    if (!message || !message.ok) throw new Error('worker did not answer')

    const direct = applyReliefSculpt(samples, extent, undefined, {
      kind: 'raiseDisk',
      disk,
      amount: 3,
    })
    expect(packedOf(message).chunks).toEqual(changedChunks(undefined, direct))
  })

  /** In the form the DOCUMENT holds: nothing is left for the UI thread to encode on arrival. */
  it('answers packed chunks, and nothing to transfer beside them', () => {
    ask(5)

    const message = posted[0]?.[0] as ReliefSculptResponse
    if (!message || !message.ok) throw new Error('worker did not answer')
    expect(message.chunks.length).toBeGreaterThan(0)
    expect(message.chunks.every(chunk => typeof chunk.payload === 'string')).toBe(true)
    expect(posted[0]?.[1]).toBeUndefined()
  })
})
