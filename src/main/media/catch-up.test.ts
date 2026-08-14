import { describe, expect, it, vi } from 'vitest'
import type { Asset, MediaProbe } from '@shared/domain/asset'
import { catchUpMedia, needsDeriving, type CatchUpDeps } from './catch-up'

const probe: MediaProbe = { duration: 5_000_000, codec: 'avc1', height: 480, sampleRate: 48_000 }

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'Terrier',
  type: 'video',
  location: 'local',
  path: 'assets/vid/asset-1.mp4',
  tags: [],
  createdAt: '2026-08-14T10:00:00.000Z',
  ...overrides,
})

function deps(overrides: Partial<CatchUpDeps> = {}): CatchUpDeps {
  return {
    list: vi.fn(async () => [asset()]),
    fileOf: (given: Asset) => `/project/${given.path}`,
    probeFile: vi.fn(async () => probe),
    save: vi.fn(),
    derive: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('what still has to be derived', () => {
  it('takes a generated rush that never met the pipeline', () => {
    expect(needsDeriving(asset())).toBe(true)
  })

  /**
   * `hash` is written by both ways in, so it is what says the pipeline has already run. Reading
   * the waveform instead would never settle: a silent rush has none by right, and it would be
   * picked up again on every project opened.
   */
  it('leaves a take the pipeline has already run on, waveform or not', () => {
    expect(needsDeriving(asset({ hash: 'abc123' }))).toBe(false)
  })

  it('leaves what has no timeline of its own, and what is not on this disk', () => {
    expect(needsDeriving(asset({ type: 'image' }))).toBe(false)
    expect(needsDeriving(asset({ location: 'cloud' }))).toBe(false)
    expect(needsDeriving(asset({ path: undefined }))).toBe(false)
  })
})

describe('catching up a project that was opened after the fix', () => {
  it('reads the length nobody had read, and records it', async () => {
    const injected = deps()

    await catchUpMedia(injected)

    expect(injected.save).toHaveBeenCalledWith('asset-1', { probe })
    expect(injected.derive).toHaveBeenCalledWith({
      assetId: 'asset-1',
      path: '/project/assets/vid/asset-1.mp4',
      kind: 'video',
      probe,
      poster: true,
    })
  })

  // The library's still is a picture OF the take, chosen by whoever produced it. A frame grabbed
  // here would overwrite it with an arbitrary one.
  it('leaves the still a download already brought down', async () => {
    const injected = deps({
      list: async () => [asset({ posterPath: '.index/posters/asset-1.jpg' })],
    })

    await catchUpMedia(injected)

    expect(injected.derive).toHaveBeenCalledWith(expect.objectContaining({ poster: false }))
  })

  it('spends no probe on a take that was already read', async () => {
    const injected = deps({ list: async () => [asset({ probe })] })

    await catchUpMedia(injected)

    expect(injected.probeFile).not.toHaveBeenCalled()
    expect(injected.save).not.toHaveBeenCalled()
    expect(injected.derive).toHaveBeenCalledOnce()
  })

  // Without a length there is no bucket count for a waveform and no offset for a still. The row
  // is left exactly as it was, and the next project opened tries again.
  it('writes nothing for a take nothing can read', async () => {
    const injected = deps({ probeFile: async () => null })

    expect(await catchUpMedia(injected)).toBe(0)
    expect(injected.save).not.toHaveBeenCalled()
    expect(injected.derive).not.toHaveBeenCalled()
  })

  /**
   * One at a time, behind a project that has just opened: `derive` bounds its own ffmpeg, and
   * `probeFile` bounds nothing at all — forty takes would be forty ffprobes competing with
   * whatever the user is doing in the second after the project appeared.
   */
  it('runs them one after another rather than all at once', async () => {
    let running = 0
    let peak = 0
    const injected = deps({
      list: async () => [asset(), asset({ id: 'asset-2' }), asset({ id: 'asset-3' })],
      derive: vi.fn(async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise(resolve => setTimeout(resolve, 0))
        running -= 1
      }),
    })

    expect(await catchUpMedia(injected)).toBe(3)
    expect(peak).toBe(1)
  })
})
