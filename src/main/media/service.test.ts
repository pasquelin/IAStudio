import { describe, expect, it, vi } from 'vitest'
import type { MediaProbe } from '@shared/domain/asset'
import { createMediaService, needsProxy, type MediaServiceDeps } from './service'

const probe: MediaProbe = {
  duration: 20_000_000,
  codec: 'prores',
  width: 3840,
  height: 2160,
  fps: 25,
  sampleRate: 48_000,
  channels: 2,
}

function deps(overrides: Partial<MediaServiceDeps> = {}): MediaServiceDeps {
  return {
    ffmpeg: () => '/usr/bin/ffmpeg',
    run: vi.fn(async () => Buffer.alloc(0)),
    probe: vi.fn(async () => probe),
    hash: vi.fn(async () => 'abc123'),
    save: vi.fn(),
    writeFile: vi.fn(async () => undefined),
    onProgress: vi.fn(),
    projectPath: () => '/tmp/project',
    concurrency: () => 4,
    ...overrides,
  }
}

const stages = (onProgress: unknown): string[] =>
  vi.mocked(onProgress as MediaServiceDeps['onProgress']).mock.calls.map(([event]) => event.stage)

describe('proxy decision', () => {
  it('asks for a proxy when the codec is not decodable by WebCodecs', () => {
    expect(needsProxy({ ...probe, height: 720 })).toBe(true)
  })

  it('asks for a proxy above 1080p even for a decodable codec', () => {
    expect(needsProxy({ ...probe, codec: 'avc1', height: 2160 })).toBe(true)
  })

  it('skips the proxy for a small H.264 file, which is the generated-clip case', () => {
    expect(needsProxy({ ...probe, codec: 'avc1', height: 1080 })).toBe(false)
  })

  it('skips the proxy for the codec names ffprobe uses, not only the WebCodecs ones', () => {
    expect(needsProxy({ ...probe, codec: 'h264', height: 1080 })).toBe(false)
    expect(needsProxy({ ...probe, codec: 'av1', height: 1080 })).toBe(false)
  })

  it('never asks for a video proxy for an audio-only file', () => {
    expect(needsProxy({ duration: 1, codec: 'mp3', sampleRate: 44_100 })).toBe(false)
  })
})

describe('media service', () => {
  it('reports every stage in order', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

    expect(stages(injected.onProgress)).toEqual([
      'queued',
      'probe',
      'hash',
      'proxy',
      'peaks',
      'done',
    ])
  })

  it('records the probe, the hash and the derived files on the asset', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

    expect(injected.save).toHaveBeenCalledWith('asset-1', {
      sourcePath: '/Volumes/Rushes/rush.mov',
      probe,
      hash: 'abc123',
      proxyPath: '.index/proxies/abc123.mp4',
      peaksPath: '.index/peaks/abc123.bin',
    })
  })

  it('skips the proxy for a file the browser can already decode', async () => {
    const injected = deps({ probe: vi.fn(async () => ({ ...probe, codec: 'avc1', height: 1080 })) })
    await createMediaService(injected).ingest('asset-1', '/clip.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'peaks', 'done'])
  })

  it('stops at the probe and says so when ffmpeg is missing', async () => {
    const injected = deps({ ffmpeg: () => null })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

    expect(service.available()).toBe(false)
    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'done'])
    expect(injected.save).toHaveBeenCalledWith('asset-1', {
      sourcePath: '/Volumes/Rushes/rush.mov',
      probe,
      hash: 'abc123',
    })
  })

  it('stops a run that was cancelled rather than finishing it in the background', async () => {
    const injected = deps()
    injected.hash = vi.fn(async () => {
      service.cancel('asset-1')
      return 'abc123'
    })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/rush.mov', 'video')

    expect(stages(injected.onProgress)).not.toContain('done')
    expect(injected.run).not.toHaveBeenCalled()
  })

  it('announces a cancellation, so every window drops the row and not only this one', async () => {
    const injected = deps()
    injected.hash = vi.fn(async () => {
      service.cancel('asset-1')
      return 'abc123'
    })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/rush.mov', 'video')
    expect(stages(injected.onProgress).at(-1)).toBe('cancelled')
  })

  it('keeps what the earlier stages found when a later one fails', async () => {
    const injected = deps({
      run: vi.fn(async () => {
        throw new Error('unsupported pixel format')
      }),
    })

    await createMediaService(injected).ingest('asset-1', '/rush.mov', 'video')

    // There is no retry, and re-picking the file makes a new row: a probe thrown away here is
    // a clip with no length, for good.
    expect(injected.save).toHaveBeenCalledWith('asset-1', {
      sourcePath: '/rush.mov',
      probe,
      hash: 'abc123',
    })
  })

  it('neither proxies nor draws a waveform for a still, which has no time in it', async () => {
    const injected = deps({
      probe: vi.fn(async () => ({ duration: 0, codec: 'png', width: 4000, height: 3000 })),
    })

    await createMediaService(injected).ingest('asset-1', '/plate.png', 'image')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'done'])
    expect(injected.run).not.toHaveBeenCalled()
  })

  it('reports the failure instead of throwing into the importer', async () => {
    const injected = deps({
      probe: vi.fn(async () => {
        throw new Error('not a media file')
      }),
    })

    await expect(
      createMediaService(injected).ingest('asset-1', '/notes.txt', 'video'),
    ).resolves.toBeUndefined()
    // A stage is announced when it starts, so the one that failed is named before the failure.
    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'failed'])
  })

  it('imports a file it could not probe, which is what a missing ffprobe leaves', async () => {
    const injected = deps({ probe: vi.fn(async () => null) })

    await createMediaService(injected).ingest('asset-1', '/clip.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'done'])
    expect(injected.save).toHaveBeenCalledWith('asset-1', {
      sourcePath: '/clip.mp4',
      hash: 'abc123',
    })
  })

  it('aborts the running binary on cancel, so a twenty-minute proxy stops at once', async () => {
    const injected = deps()
    let aborted: boolean | null = null
    injected.run = vi.fn(async (_binary, _args, signal) => {
      service.cancel('asset-1')
      aborted = signal.aborted
      return Buffer.alloc(0)
    })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/rush.mov', 'video')
    expect(aborted).toBe(true)
  })

  it('runs no more ingests at once than the pool allows', async () => {
    let running = 0
    let peak = 0
    const injected = deps({
      concurrency: () => 2,
      probe: vi.fn(async () => {
        running += 1
        peak = Math.max(peak, running)
        await Promise.resolve()
        running -= 1
        return probe
      }),
    })
    const service = createMediaService(injected)

    // Six rushes picked at once would be six ffmpeg processes without the pool — CLAUDE.md § 6.
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e', 'f'].map(id => service.ingest(id, `/${id}.mov`, 'video')),
    )

    expect(peak).toBeLessThanOrEqual(2)
  })

  it('cancels an ingest still waiting for its turn, without ever starting it', async () => {
    const injected = deps({ concurrency: () => 1 })
    const service = createMediaService(injected)

    const first = service.ingest('asset-1', '/a.mov', 'video')
    const second = service.ingest('asset-2', '/b.mov', 'video')
    service.cancel('asset-2')
    await Promise.all([first, second])

    expect(injected.probe).toHaveBeenCalledExactlyOnceWith('/a.mov', expect.anything())
  })

  it('leaves an audio-less file without peaks', async () => {
    const injected = deps({
      probe: vi.fn(async () => ({ duration: 1, codec: 'avc1', height: 720 })),
    })

    await createMediaService(injected).ingest('asset-1', '/silent.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'done'])
  })
})
