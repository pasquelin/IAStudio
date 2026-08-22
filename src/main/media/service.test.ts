import { describe, expect, it, vi } from 'vitest'
import type { MediaProbe } from '@shared/domain/asset'
import type { ProbeOutcome } from './probe'
import {
  createMediaService,
  needsProxy,
  type DeriveRequest,
  type MediaServiceDeps,
} from './service'

const probe: MediaProbe = {
  duration: 20_000_000,
  codec: 'prores',
  width: 3840,
  height: 2160,
  fps: 25,
  sampleRate: 48_000,
  channels: 2,
}

/** A probe that succeeded, `probe` with whatever the test needed to change. */
const probing = (fields: Partial<MediaProbe> = {}) =>
  vi.fn(async (): Promise<ProbeOutcome> => ({ kind: 'probed', probe: { ...probe, ...fields } }))

function deps(overrides: Partial<MediaServiceDeps> = {}): MediaServiceDeps {
  return {
    ffmpeg: () => '/usr/bin/ffmpeg',
    run: vi.fn(async () => Buffer.alloc(0)),
    probe: probing(),
    hash: vi.fn(async () => 'abc123'),
    computePeaks: vi.fn(async () => new Float32Array(2)),
    duplicateExists: vi.fn(async () => false),
    discard: vi.fn(async () => undefined),
    save: vi.fn(),
    writeFile: vi.fn(async () => undefined),
    onProgress: vi.fn(),
    record: vi.fn(),
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
      posterPath: '.index/posters/asset-1.jpg',
      proxyPath: '.index/proxies/abc123.mp4',
      peaksPath: '.index/peaks/abc123.bin',
    })
  })

  /**
   * A rush picked off the disk has no library still to bring down, and both the shelf and the
   * clip on the strip read `posterUrl`: without this, every imported take is the same grey
   * rectangle wearing a film glyph.
   */
  it('grabs a still of a rush, taken past the black a take often opens on', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

    const args = vi.mocked(injected.run).mock.calls.map(([, given]) => given)
    // A tenth of the way into twenty seconds, and one frame out.
    expect(args[0]).toContain('2.000')
    expect(args[0]).toEqual(expect.arrayContaining(['/tmp/project/.index/posters/asset-1.jpg']))
  })

  // The still is a convenience; the rush is the asset. Same rule as the one a download brings
  // beside a mesh — a refusal here must not cost the import.
  it('imports the rush all the same when the still cannot be grabbed', async () => {
    const injected = deps({
      run: vi.fn(async (_binary: string, args: string[]) => {
        if (args.includes('-frames:v')) throw new Error('no keyframe there')
        return Buffer.alloc(0)
      }),
    })

    await createMediaService(injected).ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

    expect(stages(injected.onProgress)).toContain('done')
    expect(vi.mocked(injected.save).mock.calls[0]?.[1]).not.toHaveProperty('posterPath')
  })

  // A sound has a waveform, and a still recorded here would be painted under it.
  it('grabs none for a sound', async () => {
    const injected = deps()
    await createMediaService(injected).ingest('asset-1', '/take.wav', 'audio')

    expect(vi.mocked(injected.save).mock.calls[0]?.[1]).not.toHaveProperty('posterPath')
  })
})

/**
 * A generation never meets the picker, so nothing derived what a montage reads: its sound clip
 * drew a flat rectangle where a waveform belongs — `stores/peaks` reads the file written here
 * and never recomputes — and a codec the window cannot decode had no proxy to fall back on.
 */
describe('the files a generation gets beside it', () => {
  const request: DeriveRequest = {
    assetId: 'asset-1',
    path: '/project/assets/vid/asset-1.mp4',
    kind: 'video',
    probe: { ...probe, codec: 'avc1', height: 1080 },
    poster: false,
    announce: true,
  }

  it('writes the waveform its sound clip is drawn from, and the hash a relink finds it by', async () => {
    const injected = deps()
    await createMediaService(injected).derive(request)

    expect(injected.save).toHaveBeenCalledWith('asset-1', {
      hash: 'abc123',
      peaksPath: '.index/peaks/abc123.bin',
    })
  })

  it('encodes a proxy when the window cannot decode what the API produced', async () => {
    const injected = deps()
    await createMediaService(injected).derive({ ...request, probe })

    expect(vi.mocked(injected.save).mock.calls[0]?.[1]).toMatchObject({
      proxyPath: '.index/proxies/abc123.mp4',
    })
  })

  // The library sent one down with the bytes: a frame grabbed here would overwrite a picture
  // chosen by whoever produced the model.
  it('leaves the still alone when one came down with the bytes', async () => {
    const injected = deps()
    await createMediaService(injected).derive(request)

    const args = vi.mocked(injected.run).mock.calls.map(([, given]) => given)
    expect(args.some(given => given.includes('-frames:v'))).toBe(false)
  })

  // The row stands for an asset the account holds. A proxy that failed is a take that plays
  // without one, never a take that is gone — where a picked file that turns out not to be
  // media has its row dropped.
  it('keeps the row when ffmpeg fails, unlike a file that was picked', async () => {
    const injected = deps({ run: vi.fn(async () => Promise.reject(new Error('broken'))) })
    await createMediaService(injected).derive({ ...request, probe })

    expect(injected.discard).not.toHaveBeenCalled()
    expect(injected.save).toHaveBeenCalledWith('asset-1', { hash: 'abc123' })
  })

  /** Two rows of the same bytes would both write `.index/proxies/abc123.mp4` at once. */
  it('does not write the same proxy from two derivations of the same bytes at once', async () => {
    const injected = deps()
    let inflight = 0
    let maxInflight = 0
    injected.run = vi.fn(async () => {
      inflight += 1
      maxInflight = Math.max(maxInflight, inflight)
      await new Promise(resolve => setTimeout(resolve, 15))
      inflight -= 1
      return Buffer.alloc(0)
    })

    const service = createMediaService(injected)
    await Promise.all([
      service.derive({ ...request, assetId: 'asset-1', probe }),
      service.derive({ ...request, assetId: 'asset-2', probe }),
    ])

    expect(maxInflight).toBe(1)
  })

  it('supersedes a derivation of the same asset still on its way', async () => {
    const injected = deps()
    let releaseHash = (): void => {}
    injected.hash = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<string>(resolve => (releaseHash = () => resolve('abc123'))),
      )
      .mockImplementation(async () => 'abc123')

    const service = createMediaService(injected)
    const first = service.derive(request)
    const second = service.derive(request)

    // Waited for rather than released outright: `derive` reaches its hash a tick after the call,
    // and a release fired before that resolves a promise nobody is holding yet.
    await vi.waitFor(() => expect(injected.hash).toHaveBeenCalled())
    releaseHash()
    await Promise.all([first, second])

    expect(stages(injected.onProgress).filter(stage => stage === 'cancelled')).toEqual([
      'cancelled',
    ])
  })

  // The other half of that replacement, and the one nothing on screen would explain: the run
  // that was superseded ends LAST, and its own bookkeeping must not take the live one with it.
  it('leaves cancel pointing at the run still standing', async () => {
    const injected = deps()
    let releaseHash = (): void => {}
    let releasePeaks = (): void => {}
    injected.hash = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<string>(resolve => (releaseHash = () => resolve('abc123'))),
      )
      .mockImplementation(async () => 'abc123')
    injected.computePeaks = vi.fn(
      () =>
        new Promise<Float32Array>(resolve => (releasePeaks = () => resolve(new Float32Array(2)))),
    )

    const service = createMediaService(injected)
    const first = service.derive(request)
    const second = service.derive(request)

    await vi.waitFor(() => expect(injected.hash).toHaveBeenCalled())
    releaseHash()
    await first
    await vi.waitFor(() => expect(injected.computePeaks).toHaveBeenCalled())

    service.cancel('asset-1')
    releasePeaks()
    await second

    expect(stages(injected.onProgress).at(-1)).toBe('cancelled')
  })

  it('reports its stages, so a take being prepared is not a window doing nothing', async () => {
    const injected = deps()
    await createMediaService(injected).derive(request)

    expect(stages(injected.onProgress)).toEqual(['queued', 'hash', 'peaks', 'done'])
  })

  // The maintenance a project does on opening is not an import: those rows read as files the
  // user never picked, and a failed one leaves a notice to dismiss for a file they never chose.
  it('says nothing at all when it was not asked to announce', async () => {
    const injected = deps()
    await createMediaService(injected).derive({ ...request, announce: false })

    expect(stages(injected.onProgress)).toEqual([])
    expect(injected.save).toHaveBeenCalled()
  })

  /**
   * Nothing to derive AND nothing to remember. A row stamped with a hash reads as one the
   * pipeline has been through, so the catch-up that runs once ffmpeg IS resolved would skip it
   * for good — the take would show a grey tile and a flat waveform for the rest of its life.
   */
  it('writes nothing at all when there is no ffmpeg to derive with', async () => {
    const injected = deps({ ffmpeg: () => null })
    await createMediaService(injected).derive(request)

    expect(injected.save).not.toHaveBeenCalled()
  })

  it('skips the proxy for a file the browser can already decode', async () => {
    const injected = deps({
      probe: vi.fn(async (): Promise<ProbeOutcome> => ({
        kind: 'probed',
        probe: { ...probe, codec: 'avc1', height: 1080 },
      })),
    })
    await createMediaService(injected).ingest('asset-1', '/clip.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'peaks', 'done'])
  })

  it('stops at the probe and says so when ffmpeg is missing', async () => {
    const injected = deps({ ffmpeg: () => null })
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/Volumes/Rushes/rush.mov', 'video')

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
      probe: vi.fn(async (): Promise<ProbeOutcome> => ({
        kind: 'probed',
        probe: { duration: 0, codec: 'png', width: 4000, height: 3000 },
      })),
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
    const injected = deps({
      probe: vi.fn(async (): Promise<ProbeOutcome> => ({ kind: 'unavailable' })),
    })

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
      probe: vi.fn(async (): Promise<ProbeOutcome> => {
        running += 1
        peak = Math.max(peak, running)
        await Promise.resolve()
        running -= 1
        return { kind: 'probed', probe }
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

  it('refuses a file ffprobe read and would not have, whatever its extension claimed', async () => {
    const injected = deps({
      probe: vi.fn(async (): Promise<ProbeOutcome> => ({ kind: 'unreadable' })),
    })

    await createMediaService(injected).ingest('asset-1', '/notes.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'unreadable'])
    // A row saying a text file is a video is worse than no row: it plays nothing, forever.
    expect(injected.discard).toHaveBeenCalledWith('asset-1')
    expect(injected.save).not.toHaveBeenCalled()
  })

  it('drops a second pick of bytes the catalogue already holds', async () => {
    const injected = deps({ duplicateExists: vi.fn(async () => true) })

    await createMediaService(injected).ingest('asset-2', '/rush.mov', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'duplicate'])
    // The row already there keeps its tags, its proxy and its waveform.
    expect(injected.discard).toHaveBeenCalledWith('asset-2')
    expect(injected.run).not.toHaveBeenCalled()
  })

  // Two picks of the same bytes in one batch: the catalogue cannot tell them apart, since a
  // row only gains its hash once its ingest ends — and both would then write the same proxy.
  it('drops the second of two identical files picked together', async () => {
    const injected = deps({ concurrency: () => 2 })
    const service = createMediaService(injected)

    await Promise.all([
      service.ingest('asset-1', '/A001.mov', 'video'),
      service.ingest('asset-2', '/A001 copy.mov', 'video'),
    ])

    expect(injected.discard).toHaveBeenCalledTimes(1)
    expect(injected.save).toHaveBeenCalledTimes(1)
  })

  it('lets the same bytes through again once the first ingest is over', async () => {
    const injected = deps()
    const service = createMediaService(injected)

    await service.ingest('asset-1', '/A001.mov', 'video')
    await service.ingest('asset-2', '/A001.mov', 'video')

    // Nothing claimed any more: only the catalogue decides now, and this one says no duplicate.
    expect(injected.discard).not.toHaveBeenCalled()
  })

  it('leaves an audio-less file without peaks', async () => {
    const injected = deps({
      probe: vi.fn(async (): Promise<ProbeOutcome> => ({
        kind: 'probed',
        probe: { duration: 1, codec: 'avc1', height: 720 },
      })),
    })

    await createMediaService(injected).ingest('asset-1', '/silent.mp4', 'video')

    expect(stages(injected.onProgress)).toEqual(['queued', 'probe', 'hash', 'done'])
  })
})

/**
 * A twenty-minute rush is prepared while the user works elsewhere: the progress row is gone by
 * the time it ends, and a file that never arrived was a silence nobody could explain.
 */
describe('what an import leaves behind to read', () => {
  it('records the file that landed, by name and never by path', async () => {
    const record = vi.fn()
    const service = createMediaService(deps({ record, probe: probing({ codec: 'avc1' }) }))

    await service.ingest('asset_1', '/Users/someone/Movies/rush.mp4', 'video')

    expect(record).toHaveBeenCalledWith({
      level: 'info',
      topic: 'import',
      messageKey: 'activity.imported',
      params: { name: 'rush.mp4' },
    })
  })

  it('records a file the probe refused as a failure of its own', async () => {
    const record = vi.fn()
    const service = createMediaService(
      deps({ record, probe: vi.fn(async (): Promise<ProbeOutcome> => ({ kind: 'unreadable' })) }),
    )

    await service.ingest('asset_1', '/tmp/notes.txt', 'video')

    expect(record).toHaveBeenCalledWith({
      level: 'error',
      topic: 'import',
      messageKey: 'activity.importUnreadable',
      params: { name: 'notes.txt' },
    })
  })

  // The user did it: telling them about it is telling them what they already know.
  it('says nothing about an import that was cancelled', async () => {
    const record = vi.fn()
    const service = createMediaService(
      deps({ record, hash: vi.fn(async () => 'abc123'), probe: probing({ codec: 'avc1' }) }),
    )

    const running = service.ingest('asset_1', '/tmp/rush.mp4', 'video')
    service.cancel('asset_1')
    await running

    expect(record).not.toHaveBeenCalled()
  })

  // Not a problem: the bytes are already in the project, which is what the user wanted.
  it('says nothing about bytes the project already holds', async () => {
    const record = vi.fn()
    const service = createMediaService(
      deps({ record, duplicateExists: vi.fn(async () => true), probe: probing({ codec: 'avc1' }) }),
    )

    await service.ingest('asset_1', '/tmp/rush.mp4', 'video')

    expect(record).not.toHaveBeenCalled()
  })
})
