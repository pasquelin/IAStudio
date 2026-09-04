import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerMediaHandlers, type MediaHandlerDeps } from './handlers'
import { linkedAsset } from './link'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

function deps(overrides: Partial<MediaHandlerDeps> = {}): MediaHandlerDeps {
  let linked = 0
  return {
    media: {
      ingest: vi.fn(async () => undefined),
      derive: vi.fn(async () => undefined),
      cancel: vi.fn(),
    },
    link: vi.fn(async (source: string, type: Asset['type']) =>
      linkedAsset(source, {
        id: `asset-${(linked += 1)}`,
        type,
        now: '2026-08-07T10:00:00.000Z',
      }),
    ),
    adopt: vi.fn(async () => null),
    pickMedia: vi.fn(async () => ['/Volumes/Rushes/A001.mov']),
    capabilities: async () => ({ ffmpeg: true }),
    importPaths: async () => ({ assets: [], documents: [], montages: [], refused: [] }),
    claimExternalFiles: () => [],
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
      { name: 'a', type: 'video' },
      { name: 'b', type: 'audio' },
    ])
    expect(injected.link).toHaveBeenCalledTimes(2)
  })

  // The renderer has no filesystem: a path there is only ever text on screen, and handing the
  // window every user's folder layout widens what a compromised dependency could read.
  it('tells the window everything about a linked file except where it is', async () => {
    registerMediaHandlers(deps({ pickMedia: async () => ['/Volumes/Rushes/a.mov'] }))

    const assets = await invoke(CHANNELS.mediaIngest)

    expect(assets).toEqual([expect.not.objectContaining({ sourcePath: expect.anything() })])
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

  it('imports paths supplied by the desktop into the requested project folder', async () => {
    const imported = linkedAsset('/outside/model.glb', {
      id: 'asset-1',
      type: 'mesh',
      now: '2026-09-03T10:00:00.000Z',
    })
    const importPaths = vi.fn(async () => ({
      assets: [imported],
      documents: [],
      montages: [],
      refused: [],
    }))
    registerMediaHandlers(deps({ importPaths, claimExternalFiles: () => ['/outside/model.glb'] }))

    const result = await invoke(CHANNELS.mediaIngestPaths, 'request-1', 'Models')

    expect(importPaths).toHaveBeenCalledWith(['/outside/model.glb'], 'Models')
    expect(result).toEqual({
      assets: [expect.not.objectContaining({ sourcePath: expect.anything() })],
      documents: [],
      montages: [],
      refused: [],
    })
  })

  it('adopts a file of the project, and answers the row without its whereabouts', async () => {
    const injected = deps({
      adopt: vi.fn(async (relative: string) =>
        linkedAsset(`/projects/one/${relative}`, {
          id: 'asset-9',
          type: 'image',
          now: '2026-08-17T10:00:00.000Z',
        }),
      ),
    })
    registerMediaHandlers(injected)

    const asset = await invoke(CHANNELS.mediaAdopt, 'Images/facade.jpg')

    expect(injected.adopt).toHaveBeenCalledWith('Images/facade.jpg')
    expect(asset).toEqual(expect.not.objectContaining({ sourcePath: expect.anything() }))
  })

  it('answers nothing for a file the studio has no editor for', async () => {
    registerMediaHandlers(deps())

    await expect(invoke(CHANNELS.mediaAdopt, 'Notes/brief.txt')).resolves.toBeNull()
  })

  // The one channel where a window names a path of its own — `../../.ssh/id_rsa` would otherwise
  // reach the disk through it.
  it('refuses a path that walks out of the project', async () => {
    const injected = deps()
    registerMediaHandlers(injected)

    await expect(invoke(CHANNELS.mediaAdopt, '../../.ssh/id_rsa')).rejects.toThrow()
    expect(injected.adopt).not.toHaveBeenCalled()
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

  it('reports what the pipeline can do, so the interface can say what is missing', async () => {
    registerMediaHandlers(deps({ capabilities: async () => ({ ffmpeg: false }) }))
    await expect(invoke(CHANNELS.mediaAvailable)).resolves.toEqual({ ffmpeg: false })
  })
})
