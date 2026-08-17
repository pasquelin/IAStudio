import { describe, expect, it, vi } from 'vitest'
import { ASSET_NAME_MAX_LENGTH, type Asset } from '@shared/domain/asset'
import type { ActivityReport } from '@main/project/activityLog'
import { CAPTION_BATCH, createCaptioner, worthCaptioning } from './auto-caption'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'local-1',
    name: 'IMG_4821',
    type: 'image',
    location: 'local',
    path: 'assets/IMG_4821.png',
    createdAt: '2026-08-08T10:00:00.000Z',
    tags: [],
    remoteAssetId: 'asset_one',
    ...overrides,
  }
}

describe('worthCaptioning', () => {
  it('takes a picture whose name says nothing', () => {
    expect(worthCaptioning(asset({ name: 'IMG_4821' }))).toBe(true)
    expect(worthCaptioning(asset({ name: 'DSC00123.jpg' }))).toBe(true)
    expect(worthCaptioning(asset({ name: 'Screenshot' }))).toBe(true)
    expect(worthCaptioning(asset({ name: 'untitled' }))).toBe(true)
    expect(worthCaptioning(asset({ name: '  ' }))).toBe(true)
  })

  it('leaves a name someone chose alone', () => {
    expect(worthCaptioning(asset({ name: 'mossy boulder' }))).toBe(false)
    expect(worthCaptioning(asset({ name: 'hero shot 3' }))).toBe(false)
  })

  /**
   * The names an operating system actually writes, rather than the bare word. Neither macOS nor
   * Windows stops at `Screenshot`: both append the moment it was taken, and both say it in the
   * language they are set to. A studio that captions an English user's screenshot and not a
   * French one's is a studio whose feature depends on the OS language.
   */
  it('takes a screenshot named the way an OS names it, in either language', () => {
    const shots = [
      'Screenshot 2026-08-09 at 10.30.45',
      'Screen Shot 2026-08-09 at 10.30.45',
      'Capture d’écran 2026-08-09 à 10.30.45',
      "Capture d'écran 2026-08-09 à 10.30.45",
      'Capture d’écran (3)',
      'Screenshot (3)',
    ]

    for (const name of shots) expect(worthCaptioning(asset({ name })), name).toBe(true)
  })

  it('takes the other names an OS hands out in French', () => {
    const names = ['Sans titre', 'Sans titre 2', 'Téléchargement', 'Image collée']

    for (const name of names) expect(worthCaptioning(asset({ name })), name).toBe(true)
  })

  // The words above are only uninformative where the OS put them: a caption someone wrote
  // around one is a caption, and paying to replace it would be paying to lose it.
  it('leaves those same words alone once a sentence carries them', () => {
    const chosen = ['Capture d’écran du menu principal', 'Screenshot of the main menu']

    for (const name of chosen) expect(worthCaptioning(asset({ name })), name).toBe(false)
  })

  // Captioning takes an asset id: one that never reached the library has none.
  it('skips what the API cannot see', () => {
    expect(worthCaptioning(asset({ remoteAssetId: undefined }))).toBe(false)
  })

  it('skips what is not a picture', () => {
    expect(worthCaptioning(asset({ type: 'video' }))).toBe(false)
    expect(worthCaptioning(asset({ type: 'audio' }))).toBe(false)
  })
})

function captionerOf(overrides: Partial<Parameters<typeof createCaptioner>[0]> = {}) {
  // Two arguments and not a written row: the caller moves the FILE with the name, and a port
  // handed `{ ...asset, name }` could only ever write half of that — which is how the shelf came
  // to read a caption over a file still called `IMG_1234.png`.
  const rename = vi.fn(async (given: Asset, name: string) => ({ ...given, name }))
  const reports: ActivityReport[] = []
  const caption = vi.fn(async (images: readonly string[]) => images.map(() => 'a mossy boulder'))

  const captioner = createCaptioner({
    queue: task => task(),
    caption,
    rename,
    record: report => void reports.push(report),
    enabled: () => true,
    ...overrides,
  })

  return { run: captioner.onArrival, describe: captioner.describe, rename, caption, reports }
}

describe('the captioner, on arrival', () => {
  it('names what arrived without a name of its own', async () => {
    const { run, rename } = captionerOf()

    await run([asset()])

    expect(rename).toHaveBeenCalledWith(expect.anything(), 'a mossy boulder')
  })

  it('asks nothing about what is not worth describing', async () => {
    const { run, caption, rename } = captionerOf()

    await run([asset({ name: 'mossy boulder' }), asset({ remoteAssetId: undefined })])

    expect(caption).not.toHaveBeenCalled()
    expect(rename).not.toHaveBeenCalled()
  })

  it('stays out of the way when the preference is off', async () => {
    const { run, caption } = captionerOf({ enabled: () => false })

    await run([asset()])

    expect(caption).not.toHaveBeenCalled()
  })

  it('sends the ids the API can look up, in one call per batch', async () => {
    const { run, caption } = captionerOf()
    const arriving = Array.from({ length: CAPTION_BATCH + 3 }, (_unused, at) =>
      asset({ id: `local-${at}`, remoteAssetId: `asset_${at}` }),
    )

    await run(arriving)

    expect(caption).toHaveBeenCalledTimes(2)
    expect(caption.mock.calls[0]?.[0]).toHaveLength(CAPTION_BATCH)
    expect(caption.mock.calls[1]?.[0]).toHaveLength(3)
  })

  // The API answers in the order it was asked, and the pairing depends on it.
  it('pairs each caption with the picture of the same rank', async () => {
    const { run, rename } = captionerOf({
      caption: async () => ['a boulder', 'a clearing'],
    })

    await run([asset({ id: 'local-1' }), asset({ id: 'local-2' })])

    expect(rename).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'local-1' }),
      'a boulder',
    )
    expect(rename).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'local-2' }),
      'a clearing',
    )
  })

  // The rename channel refuses more, and this path writes straight into the catalogue.
  it('holds a long caption to the length a name is allowed', async () => {
    const { run, rename } = captionerOf({
      caption: async () => ['a mossy boulder '.repeat(40)],
    })

    await run([asset()])

    const written = rename.mock.calls[0]?.[1] ?? ''
    expect(written.length).toBeLessThanOrEqual(ASSET_NAME_MAX_LENGTH)
    expect(written).not.toMatch(/\s$/)
  })

  it('leaves an asset alone when its caption came back empty', async () => {
    const { run, rename } = captionerOf({ caption: async () => ['   '] })

    await run([asset()])

    expect(rename).not.toHaveBeenCalled()
  })

  it('passes through the queue rather than calling straight out', async () => {
    let queued = 0
    const { run } = captionerOf({
      queue: task => {
        queued++
        return task()
      },
    })

    await run([asset()])

    expect(queued).toBe(1)
  })

  describe('what it reports', () => {
    it('says how many it named', async () => {
      const { run, reports } = captionerOf()

      await run([asset()])

      expect(reports).toEqual([
        expect.objectContaining({ messageKey: 'activity.captioned', params: { count: 1 } }),
      ])
    })

    it('says nothing when there was nothing to name', async () => {
      const { run, reports } = captionerOf()

      await run([asset({ name: 'mossy boulder' })])

      expect(reports).toEqual([])
    })

    // Nobody asked for this: it must not be able to break the import that brought the assets in.
    it('never throws when the API refuses', async () => {
      const { run, reports } = captionerOf({
        caption: async () => Promise.reject(new Error('rate-limited')),
      })

      await expect(run([asset()])).resolves.toBeUndefined()
      expect(reports).toEqual([
        expect.objectContaining({ level: 'warn', messageKey: 'activity.captionFailed' }),
      ])
    })

    it('carries on to the next batch when one is refused', async () => {
      let calls = 0
      const { run, rename } = captionerOf({
        caption: async images => {
          calls++
          if (calls === 1) throw new Error('rate-limited')
          return images.map(() => 'a clearing')
        },
      })

      const arriving = Array.from({ length: CAPTION_BATCH + 1 }, (_unused, at) =>
        asset({ id: `local-${at}`, remoteAssetId: `asset_${at}` }),
      )

      await run(arriving)

      expect(rename).toHaveBeenCalledTimes(1)
    })
  })
})

describe('the captioner, asked directly', () => {
  it('names a picture that already had a name, because it was pointed at', async () => {
    const { describe: run, rename } = captionerOf()

    await expect(run([asset({ name: 'mossy boulder' })])).resolves.toBe(1)
    expect(rename).toHaveBeenCalledWith(expect.anything(), 'a mossy boulder')
  })

  // Still bounded by what the API can look up, however explicit the request.
  it('skips what the API cannot see', async () => {
    const { describe: run, caption } = captionerOf()

    await expect(
      run([asset({ remoteAssetId: undefined }), asset({ type: 'video' })]),
    ).resolves.toBe(0)
    expect(caption).not.toHaveBeenCalled()
  })

  it('ignores the preference, which governs arrivals alone', async () => {
    const { describe: run, rename } = captionerOf({ enabled: () => false })

    await expect(run([asset()])).resolves.toBe(1)
    expect(rename).toHaveBeenCalled()
  })
})
