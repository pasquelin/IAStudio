import { describe, expect, it, vi } from 'vitest'
import type { Asset, MediaProbe } from '@shared/domain/asset'
import { catchUpMedia, CATCH_UP_PAGE, needsDeriving, type CatchUpDeps } from './catch-up'

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

/** A catalogue of exactly these assets, paged the way the real one answers. */
const holding = (assets: Asset[]) =>
  vi.fn(async (offset: number, limit: number) => assets.slice(offset, offset + limit))

function deps(overrides: Partial<CatchUpDeps> = {}): CatchUpDeps {
  return {
    list: holding([asset()]),
    fileOf: (given: Asset) => `/project/${given.path}`,
    probeFile: vi.fn(async () => probe),
    save: vi.fn(async () => undefined),
    derive: vi.fn(async () => undefined),
    stillOpen: () => true,
    ...overrides,
  }
}

describe('what still has to be derived', () => {
  it('takes a generated rush that never met the pipeline', () => {
    expect(needsDeriving(asset())).toBe(true)
  })

  /**
   * The probe is what ffprobe answers, so it is what says the tool has read this file. Reading
   * the waveform instead would never settle: a silent rush has none by right, and it would be
   * picked up again on every project opened.
   */
  it('leaves a take the tool has already read, waveform or not', () => {
    expect(needsDeriving(asset({ probe }))).toBe(false)
  })

  /**
   * The fingerprint says nothing about the pipeline since an import started writing one: it is
   * plain `node:fs`, so a rush generated on a studio with no ffmpeg carries one and has still
   * never been read. Marking it as done would skip it for good once the tool arrived.
   */
  it('takes a rush that carries a fingerprint but was never read', () => {
    expect(needsDeriving(asset({ hash: 'abc123' }))).toBe(true)
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
      // Maintenance, not an import: these must not scroll through the import panel as files
      // the user never picked, nor leave a failure notice to dismiss for one.
      announce: false,
    })
  })

  // The library's still is a picture OF the take, chosen by whoever produced it. A frame grabbed
  // here would overwrite it with an arbitrary one.
  it('leaves the still a download already brought down', async () => {
    const injected = deps({
      list: holding([asset({ posterPath: '.index/posters/asset-1.jpg' })]),
    })

    await catchUpMedia(injected)

    expect(injected.derive).toHaveBeenCalledWith(expect.objectContaining({ poster: false }))
  })

  /**
   * The probe is the marker now, so a take that carries one is a take the tool has read — and the
   * pass that read it is the one that derived from it. Narrower than the fingerprint it replaces:
   * a derive that crashed AFTER a good probe is no longer retried on the next opening. That case
   * needs ffprobe to answer and ffmpeg to fail on the same file, where the fingerprint could no
   * longer tell a studio without ffmpeg from one that had been through the whole pipeline.
   */
  it('leaves alone a take the tool has already read', async () => {
    const injected = deps({ list: async () => [asset({ probe })] })

    await catchUpMedia(injected)

    expect(injected.probeFile).not.toHaveBeenCalled()
    expect(injected.save).not.toHaveBeenCalled()
    expect(injected.derive).not.toHaveBeenCalled()
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
   * A search states no limit and gets the catalogue's own — two hundred, newest first. The
   * takes past that window would gain no hash, so the SAME window would come back on every
   * open and the older ones would never be reached by anything, ever.
   */
  it('walks past the first page, which is where a catalogue stops on its own', async () => {
    const many = Array.from({ length: CATCH_UP_PAGE + 3 }, (_, index) =>
      asset({ id: `asset-${index}` }),
    )
    const injected = deps({ list: holding(many) })

    expect(await catchUpMedia(injected)).toBe(many.length)
  })

  /**
   * `derive` resolves the project folder when it RUNS, not when it is asked. A run left going
   * after another project opened wrote one project's stills, proxies and waveforms into the
   * other, under ids its catalogue has never heard of.
   */
  it('stops where it is when another project comes to the front', async () => {
    let open = true
    const injected = deps({
      list: holding([asset(), asset({ id: 'asset-2' })]),
      stillOpen: () => open,
      derive: vi.fn(async () => {
        open = false
      }),
    })

    expect(await catchUpMedia(injected)).toBe(1)
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
      list: holding([asset(), asset({ id: 'asset-2' }), asset({ id: 'asset-3' })]),
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
