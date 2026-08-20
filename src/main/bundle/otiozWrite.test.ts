import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TaskWatch } from '@shared/domain/taskProgress'
import { MissingMediumError, writeOtiozFile } from './otiozWrite'

let folder: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'scenario-otioz-'))
})

const CONTENT = '{"OTIO_SCHEMA":"Timeline.1","name":"Montage"}'

/** Four bytes no deflate would leave alone, so « stored » is visible in the file's own size. */
const RUSH = new Uint8Array(4096).fill(0x41)

async function bundleWith(
  media: { name: string; bytes: Uint8Array }[],
  watch: TaskWatch = {},
): Promise<string> {
  const paths = []
  for (const one of media) {
    const path = join(folder, one.name)
    await writeFile(path, one.bytes)
    paths.push({ source: `file://${path}`, entry: `media/${one.name}`, path })
  }

  const bundle = join(folder, 'Montage.otioz')
  await writeOtiozFile(bundle, { content: CONTENT, media: paths }, watch)
  return bundle
}

/**
 * The compression method of an entry, read out of its own local header — offset 8 of the record
 * that starts with `PK\x03\x04`. `unzipSync` hands back the bytes whichever way they were stored,
 * so it cannot tell a stored entry from a deflated one, which is the thing to check here.
 */
function methodsIn(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const methods: number[] = []

  for (let at = 0; at + 30 <= bytes.byteLength; at += 1) {
    if (view.getUint32(at, true) === 0x04034b50) methods.push(view.getUint16(at + 8, true))
  }

  return methods
}

describe('the layout a reference bundle has', () => {
  it('holds the version and the cut at the root, and the media under their own folder', async () => {
    const entries = unzipSync(await readFile(await bundleWith([{ name: 'plan.mp4', bytes: RUSH }])))

    expect(Object.keys(entries)).toEqual(['version.txt', 'content.otio', 'media/plan.mp4'])
  })

  it('spells the version with no trailing newline', async () => {
    const entries = unzipSync(await readFile(await bundleWith([])))

    expect(new TextDecoder().decode(entries['version.txt'])).toBe('1.0.0')
  })

  it('carries the cut it was handed, byte for byte', async () => {
    const entries = unzipSync(await readFile(await bundleWith([])))

    expect(new TextDecoder().decode(entries['content.otio'])).toBe(CONTENT)
  })
})

describe('media, which are stored rather than compressed', () => {
  /**
   * What lets a reader play a rush in place instead of unpacking the bundle first, and what the
   * reference implementation writes. Deflating an already-compressed video buys a percent and
   * costs the whole file — `openRasterFile` holds the same rule for the PNGs of an `.ora`.
   */
  it('leaves every entry stored, method zero, media included', async () => {
    const bundle = await readFile(await bundleWith([{ name: 'plan.mp4', bytes: RUSH }]))

    expect(methodsIn(bundle)).toEqual([0, 0, 0])
  })

  it('gives back the very bytes it was handed', async () => {
    const entries = unzipSync(await readFile(await bundleWith([{ name: 'plan.mp4', bytes: RUSH }])))

    expect(entries['media/plan.mp4']).toEqual(RUSH)
  })

  it('carries several media, each under its own entry', async () => {
    const entries = unzipSync(
      await readFile(
        await bundleWith([
          { name: 'a.mp4', bytes: RUSH },
          { name: 'b.wav', bytes: new Uint8Array(64).fill(7) },
        ]),
      ),
    )

    expect(Object.keys(entries)).toEqual([
      'version.txt',
      'content.otio',
      'media/a.mp4',
      'media/b.wav',
    ])
  })
})

describe('a medium the cut names and the disk does not have', () => {
  it('refuses, naming the one to look for', async () => {
    const bundle = join(folder, 'Montage.otioz')

    await expect(
      writeOtiozFile(bundle, {
        content: CONTENT,
        media: [
          {
            source: 'file:///nowhere/plan.mp4',
            entry: 'media/plan.mp4',
            path: '/nowhere/plan.mp4',
          },
        ],
      }),
    ).rejects.toThrow(MissingMediumError)
  })

  /** Refused BEFORE anything is opened: half a bundle is worse than none, and it looks finished. */
  it('writes no file at all rather than half of one', async () => {
    const bundle = join(folder, 'Montage.otioz')

    await writeOtiozFile(bundle, {
      content: CONTENT,
      media: [
        { source: 'file:///nowhere/plan.mp4', entry: 'media/plan.mp4', path: '/nowhere/plan.mp4' },
      ],
    }).catch(() => null)

    await expect(readFile(bundle)).rejects.toThrow()
  })
})

/**
 * Big enough to cross the reporting step twice — a rush of a few kilobytes is written in one
 * chunk, and every case below would then be green on the final report alone.
 */
const LONG_RUSH = new Uint8Array(9 * 1024 * 1024).fill(0x43)

describe('a bundle somebody is waiting on', () => {
  /**
   * By BYTES, not by file: a montage is one thirty-gigabyte rush among six small ones, and a bar
   * counting files would sit at 1/7 for the whole export and then jump to the end.
   */
  it('reports its share of the bytes, and reaches all of them', async () => {
    const steps: { done: number; total: number }[] = []

    await bundleWith([{ name: 'a.mp4', bytes: LONG_RUSH }], {
      onStep: (done, total) => steps.push({ done, total }),
    })

    const total = CONTENT.length + LONG_RUSH.length
    expect(steps.at(-1)).toEqual({ done: total, total })
    expect(steps.length).toBeGreaterThan(1)
    // Strictly growing, and never past the whole: a bar that goes backwards is worse than none.
    expect(steps.map(one => one.done)).toEqual(
      [...steps.map(one => one.done)].sort((a, b) => a - b),
    )
  })

  /**
   * The source is read a mebibyte at a time, so a report per chunk would push nine of them here
   * and a thousand on a gigabyte — through two process boundaries, to move a bar that shows a
   * hundred states. Four megabytes is the step `modelDownload` already settled on.
   */
  it('reports far less often than it reads, so a long bundle floods nothing', async () => {
    let steps = 0

    await bundleWith([{ name: 'a.mp4', bytes: LONG_RUSH }], { onStep: () => (steps += 1) })

    expect(steps).toBeLessThan(LONG_RUSH.length / (1024 * 1024))
  })

  it('stops when asked, and takes the half-written archive with it', async () => {
    const controller = new AbortController()
    const bundle = join(folder, 'Montage.otioz')
    const rush = join(folder, 'plan.mp4')
    await writeFile(rush, LONG_RUSH)

    await expect(
      writeOtiozFile(
        bundle,
        {
          content: CONTENT,
          media: [{ source: `file://${rush}`, entry: 'media/plan.mp4', path: rush }],
        },
        // Stopped at the first report, which lands well inside the rush: it is the media loop
        // that has to unwind, not the tail of the write.
        { onStep: () => controller.abort(), signal: controller.signal },
      ),
    ).resolves.toBe(false)

    await expect(readFile(bundle)).rejects.toThrow()
  })

  /**
   * The stop of the walk that checks the media is READ, never waited for: the listener carrying
   * every other stop is attached after it, and one added to an already-raised signal never fires.
   * Two thousand media on a network volume is a long walk to press Stop into for nothing.
   */
  it('stops during the walk that checks the media, before a file exists', async () => {
    const controller = new AbortController()
    const bundle = join(folder, 'Montage.otioz')
    const rush = join(folder, 'plan.mp4')
    await writeFile(rush, RUSH)

    // Fires while the first `stat` is still out on the thread pool — the immediate phase comes
    // before the poll phase where its answer lands.
    setImmediate(() => controller.abort())

    await expect(
      writeOtiozFile(
        bundle,
        {
          content: CONTENT,
          media: [{ source: `file://${rush}`, entry: 'media/plan.mp4', path: rush }],
        },
        { signal: controller.signal },
      ),
    ).resolves.toBe(false)

    await expect(readFile(bundle)).rejects.toThrow()
  })

  /** Nothing was written, so there is nothing to remove and no failure to report either. */
  it('answers not-written for a stop that arrived before it began', async () => {
    const bundle = join(folder, 'Montage.otioz')

    await expect(
      writeOtiozFile(bundle, { content: CONTENT, media: [] }, { signal: AbortSignal.abort() }),
    ).resolves.toBe(false)

    await expect(readFile(bundle)).rejects.toThrow()
  })
})
