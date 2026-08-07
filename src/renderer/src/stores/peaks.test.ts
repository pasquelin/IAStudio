import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeaks } from './peaks'

const peaks = vi.fn((assetId: string) => Promise.resolve(waveforms[assetId] ?? null))
let waveforms: Record<string, Float32Array | null> = {}

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ assets: { peaks } }),
}))

/** A three-minute take, as it is written at ingest: 50 pairs a second, two floats a pair. */
const TAKE_FLOATS = 180 * 50 * 2
const take = (): Float32Array => new Float32Array(TAKE_FLOATS)

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('usePeaks', () => {
  beforeEach(() => {
    peaks.mockClear()
    waveforms = {}
    usePeaks.setState({ byAsset: {} })
  })

  it('fetches a waveform once, however many paints ask for it', async () => {
    waveforms['asset-1'] = take()

    usePeaks.getState().request('asset-1')
    usePeaks.getState().request('asset-1')
    await settle()
    usePeaks.getState().request('asset-1')

    expect(peaks).toHaveBeenCalledTimes(1)
    expect(usePeaks.getState().byAsset['asset-1']).toHaveLength(TAKE_FLOATS)
  })

  it('remembers that an asset has nothing to draw, rather than asking again', async () => {
    usePeaks.getState().request('asset-mute')
    await settle()
    usePeaks.getState().request('asset-mute')

    expect(peaks).toHaveBeenCalledTimes(1)
    expect(usePeaks.getState().byAsset['asset-mute']).toBeNull()
  })

  it('stays under its budget rather than growing for the life of the session', async () => {
    for (let index = 0; index < 600; index++) {
      waveforms[`asset-${index}`] = take()
      usePeaks.getState().request(`asset-${index}`)
      await settle()
    }

    const held = Object.values(usePeaks.getState().byAsset).reduce(
      (bytes, entry) => bytes + (entry?.byteLength ?? 0),
      0,
    )
    expect(held).toBeLessThanOrEqual(32 * 1024 * 1024)
  })

  it('drops the oldest arrival first, and keeps the newest', async () => {
    for (let index = 0; index < 600; index++) {
      waveforms[`asset-${index}`] = take()
      usePeaks.getState().request(`asset-${index}`)
      await settle()
    }

    const { byAsset } = usePeaks.getState()
    expect(byAsset['asset-599']).toBeDefined()
    expect('asset-0' in byAsset).toBe(false)
  })
})
