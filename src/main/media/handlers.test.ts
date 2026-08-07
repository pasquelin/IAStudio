import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerMediaHandlers, type MediaHandlerDeps } from './handlers'
import { linkedAsset } from './link'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

function deps(overrides: Partial<MediaHandlerDeps> = {}): MediaHandlerDeps {
  let linked = 0
  return {
    media: { ingest: vi.fn(async () => undefined), cancel: vi.fn() },
    link: vi.fn(async (source: string, type: Asset['type']) =>
      linkedAsset(source, {
        id: `asset-${(linked += 1)}`,
        type,
        now: '2026-08-07T10:00:00.000Z',
      }),
    ),
    pickMedia: vi.fn(async () => ['/Volumes/Rushes/A001.mov']),
    capabilities: () => ({ ffmpeg: true }),
    ...overrides,
  }
}

describe('media handlers', () => {
  beforeEach(() => {
    resetHandlers()
    vi.clearAllMocks()
  })

  it('links every picked file into the catalogue', async () => {
    const injected = deps({ pickMedia: async () => ['/rushes/a.mov', '/takes/b.wav'] })
    registerMediaHandlers(injected)

    const assets = await invoke(CHANNELS.mediaIngest)

    expect(assets).toMatchObject([
      { name: 'a', type: 'video', sourcePath: '/rushes/a.mov' },
      { name: 'b', type: 'audio', sourcePath: '/takes/b.wav' },
    ])
    expect(injected.link).toHaveBeenCalledTimes(2)
  })

  it('starts an ingest per linked file, without waiting for it to finish', async () => {
    const injected = deps()
    registerMediaHandlers(injected)

    await invoke(CHANNELS.mediaIngest)

    // Resolving on the catalogue rows is what puts the file in the browser at once; probing a
    // twenty-minute rush must not hold the dialog open.
    expect(injected.media.ingest).toHaveBeenCalledWith(
      'asset-1',
      '/Volumes/Rushes/A001.mov',
      'video',
    )
  })

  it('ignores a file the studio has no editor for, rather than cataloguing a text file', async () => {
    const injected = deps({ pickMedia: async () => ['/notes.txt', '/rushes/a.mov'] })
    registerMediaHandlers(injected)

    const assets = await invoke(CHANNELS.mediaIngest)

    expect(assets).toHaveLength(1)
    expect(injected.link).toHaveBeenCalledOnce()
  })

  it('answers an empty list when the dialog was dismissed', async () => {
    const injected = deps({ pickMedia: async () => [] })
    registerMediaHandlers(injected)

    await expect(invoke(CHANNELS.mediaIngest)).resolves.toEqual([])
    expect(injected.media.ingest).not.toHaveBeenCalled()
  })

  it('cancels the ingest of one asset', async () => {
    const injected = deps()
    registerMediaHandlers(injected)

    await invoke(CHANNELS.mediaCancel, 'asset-1')
    expect(injected.media.cancel).toHaveBeenCalledWith('asset-1')
  })

  it('refuses a cancel with no asset to cancel, rather than passing junk down', () => {
    registerMediaHandlers(deps())
    expect(() => invoke(CHANNELS.mediaCancel, '')).toThrow()
  })

  it('reports what the pipeline can do, so the interface can say what is missing', () => {
    registerMediaHandlers(deps({ capabilities: () => ({ ffmpeg: false }) }))
    expect(invoke(CHANNELS.mediaAvailable)).toEqual({ ffmpeg: false })
  })
})
