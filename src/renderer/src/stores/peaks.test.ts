import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeClip } from '@/engines/timeline/timelineState'
import { peaksOf, usePeaks } from './peaks'

const peaks = vi.fn((assetId: string) => Promise.resolve(waveforms[assetId] ?? null))
let waveforms: Record<string, Float32Array | null> = {}

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ assets: { peaks } }),
}))

const peaksFromBytesOffThread = vi.hoisted(() => vi.fn(async () => new Float32Array(2 * 50 * 2)))

vi.mock('@/engines/audio/decodePort', () => ({
  peaksFromBytesOffThread,
  decodeBytesOffThread: vi.fn(),
}))

vi.mock('@/helpers/assetFetch', () => ({
  fetchAsset: () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
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
    peaksFromBytesOffThread.mockClear()
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
    peaksFromBytesOffThread.mockRejectedValueOnce(new Error('not sound'))

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
    expect(peaksFromBytesOffThread).toHaveBeenCalled()
  })

  it('reads the file the ingest wrote rather than the take, whenever there is one', async () => {
    waveforms['asset-1'] = take()

    usePeaks.getState().request('asset-1')
    await settle()

    expect(peaksFromBytesOffThread).not.toHaveBeenCalled()
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

describe('peaksOf, what a painter asks a clip for', () => {
  beforeEach(() => {
    peaks.mockClear()
    waveforms = {}
    usePeaks.setState({ byAsset: {} })
  })

  const clip = makeClip({ id: 'clip-1', assetId: 'asset-1', start: 0, duration: 1_000_000 })

  it('draws nothing on the first ask and the waveform once it has landed', async () => {
    waveforms['asset-1'] = take()

    expect(peaksOf(clip)).toBeNull()
    await settle()

    expect(peaksOf(clip)).toBe(usePeaks.getState().byAsset['asset-1'])
  })

  it('asks once however many frames paint the same clip', () => {
    peaksOf(clip)
    peaksOf(clip)

    expect(peaks).toHaveBeenCalledTimes(1)
  })
})
