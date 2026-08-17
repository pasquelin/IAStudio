import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePeaks } from './peaks'

const peaks = vi.fn((assetId: string) => Promise.resolve(waveforms[assetId] ?? null))
let waveforms: Record<string, Float32Array | null> = {}

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ assets: { peaks } }),
}))

const decodeAsset = vi.hoisted(() =>
  vi.fn((_assetId: string) =>
    Promise.resolve({ sampleRate: 100, channels: [new Float32Array(200).fill(0.5)] }),
  ),
)

vi.mock('@/helpers/audioDecode', () => ({ decodeAsset }))

/** A three-minute take, as it is written at ingest: 50 pairs a second, two floats a pair. */
const TAKE_FLOATS = 180 * 50 * 2
const take = (): Float32Array => new Float32Array(TAKE_FLOATS)

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('usePeaks', () => {
  beforeEach(() => {
    peaks.mockClear()
    decodeAsset.mockClear()
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
    decodeAsset.mockRejectedValueOnce(new Error('not sound'))

    usePeaks.getState().request('asset-mute')
    await settle()
    usePeaks.getState().request('asset-mute')

    expect(peaks).toHaveBeenCalledTimes(1)
    expect(usePeaks.getState().byAsset['asset-mute']).toBeNull()
  })

  /**
   * The ingest writes these at import — but an asset that came down from the API before ffmpeg
   * was reachable has no file to read, and a montage of clips drawing nothing under an editor
   * drawing a full waveform is the studio contradicting itself.
   */
  it('derives a waveform from the take itself when the ingest wrote none', async () => {
    usePeaks.getState().request('asset-fresh')
    await settle()

    // Two seconds at 50 pairs a second, two floats a pair.
    expect(usePeaks.getState().byAsset['asset-fresh']).toHaveLength(2 * 50 * 2)
    expect(decodeAsset).toHaveBeenCalledWith('asset-fresh')
  })

  it('reads the file the ingest wrote rather than the take, whenever there is one', async () => {
    waveforms['asset-1'] = take()

    usePeaks.getState().request('asset-1')
    await settle()

    expect(decodeAsset).not.toHaveBeenCalled()
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
