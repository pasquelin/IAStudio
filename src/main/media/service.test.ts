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

  it('never asks for a video proxy for an audio-only file', () => {
    expect(needsProxy({ duration: 1, codec: 'mp3', sampleRate: 44_100 })).toBe(false)
  })
})

describe('media service', () => {
  it('reports every stage in order', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov')

    expect(stages(injected.onProgress)).toEqual(['probe', 'hash', 'proxy', 'peaks', 'done'])
  })

  it('records the probe, the hash and the derived files on the asset', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov')

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
    await createMediaService(injected).ingest('asset-1', '/clip.mp4')

    expect(stages(injected.onProgress)).toEqual(['probe', 'hash', 'peaks', 'done'])
  })

  it('stops at the probe and says so when ffmpeg is missing', async () => {
    const injected = deps({ ffmpeg: () => null })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/Volumes/Rushes/rush.mov')

    expect(service.available()).toBe(false)
    expect(stages(injected.onProgress)).toEqual(['probe', 'hash', 'done'])
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

    await service.ingest('asset-1', '/rush.mov')

    expect(stages(injected.onProgress)).not.toContain('done')
    expect(injected.run).not.toHaveBeenCalled()
  })

  it('reports the failure instead of throwing into the importer', async () => {
    const injected = deps({
      probe: vi.fn(async () => {
        throw new Error('not a media file')
      }),
    })

    await expect(
      createMediaService(injected).ingest('asset-1', '/notes.txt'),
    ).resolves.toBeUndefined()
    // A stage is announced when it starts, so the one that failed is named before the failure.
    expect(stages(injected.onProgress)).toEqual(['probe', 'failed'])
  })

  it('leaves an audio-less file without peaks', async () => {
    const injected = deps({
      probe: vi.fn(async () => ({ duration: 1, codec: 'avc1', height: 720 })),
    })

    await createMediaService(injected).ingest('asset-1', '/silent.mp4')

    expect(stages(injected.onProgress)).toEqual(['probe', 'hash', 'done'])
  })
})
