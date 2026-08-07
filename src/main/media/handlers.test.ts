import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { registerMediaHandlers, type MediaHandlerDeps } from './handlers'

type Invoke = (...args: unknown[]) => unknown

const { registered } = vi.hoisted(() => ({ registered: new Map<string, Invoke>() }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Invoke) => void registered.set(channel, handler),
  },
}))

function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = registered.get(channel)
  if (!handler) throw new Error(`no handler registered for ${channel}`)
  return handler({}, ...args)
}

function deps(overrides: Partial<MediaHandlerDeps> = {}): MediaHandlerDeps {
  const added: Asset[] = []
  return {
    media: { ingest: vi.fn(async () => undefined), cancel: vi.fn(), available: () => true },
    addAsset: vi.fn((asset: Asset) => {
      added.push(asset)
      return asset
    }),
    pickMedia: vi.fn(async () => ['/Volumes/Rushes/A001.mov']),
    newId: () => `asset-${added.length + 1}`,
    now: () => '2026-08-07T10:00:00.000Z',
    ...overrides,
  }
}

describe('media handlers', () => {
  beforeEach(() => {
    registered.clear()
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
    expect(injected.addAsset).toHaveBeenCalledTimes(2)
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
    expect(injected.addAsset).toHaveBeenCalledOnce()
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
    registerMediaHandlers(
      deps({ media: { ingest: vi.fn(), cancel: vi.fn(), available: () => false } }),
    )
    expect(invoke(CHANNELS.mediaAvailable)).toEqual({ ffmpeg: false })
  })
})
