import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { OTIOZ_CONTENT_PATH, OTIOZ_VERSION, OTIOZ_VERSION_PATH } from '@shared/domain/otioz'
import { BundleEscapeError, NotABundleError, readOtiozFile } from './otiozRead'
import { writeOtiozFile } from './otiozWrite'

let folder: string
let into: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'scenario-read-'))
  into = join(folder, 'unpacked')
  await mkdir(into)
})

const CONTENT = '{"OTIO_SCHEMA":"Timeline.1","name":"Montage"}'
const RUSH = new Uint8Array(4096).fill(0x41)

/** A bundle written by the studio's own writer — the round trip is what this file is about. */
async function ours(media: { name: string; bytes: Uint8Array }[] = []): Promise<string> {
  const paths = []
  for (const one of media) {
    const path = join(folder, one.name)
    await writeFile(path, one.bytes)
    paths.push({ source: `file://${path}`, entry: `media/${one.name}`, path })
  }

  const archive = join(folder, 'Bande.otioz')
  await writeOtiozFile(archive, { content: CONTENT, media: paths })
  return archive
}

/** One built entry by entry, for the shapes the writer would never produce. */
async function handMade(entries: Record<string, string | Uint8Array>): Promise<string> {
  const archive = join(folder, 'Foreign.otioz')
  const zipped: Record<string, Uint8Array> = {}
  for (const [name, value] of Object.entries(entries)) {
    zipped[name] = typeof value === 'string' ? strToU8(value) : value
  }
  await writeFile(archive, zipSync(zipped, { level: 0 }))
  return archive
}

describe('a bundle this studio wrote', () => {
  it('gives back the very cut it was handed', async () => {
    const read = await readOtiozFile(await ours(), into)

    expect(read?.content).toBe(CONTENT)
  })

  it('lands each medium under the name its entry gives it, byte for byte', async () => {
    const read = await readOtiozFile(await ours([{ name: 'plan.mp4', bytes: RUSH }]), into)

    expect(read?.media).toEqual([{ entry: 'media/plan.mp4', file: 'plan.mp4' }])
    expect(new Uint8Array(await readFile(join(into, 'plan.mp4')))).toEqual(RUSH)
  })

  it('carries several media, each under its own name', async () => {
    const read = await readOtiozFile(
      await ours([
        { name: 'a.mp4', bytes: RUSH },
        { name: 'b.wav', bytes: new Uint8Array(64).fill(7) },
      ]),
      into,
    )

    expect(read?.media.map(one => one.file)).toEqual(['a.mp4', 'b.wav'])
    expect((await readdir(into)).sort()).toEqual(['a.mp4', 'b.wav'])
  })

  it('reports how far it has got, and reaches the whole archive', async () => {
    const steps: { done: number; total: number }[] = []

    await readOtiozFile(await ours([{ name: 'plan.mp4', bytes: RUSH }]), into, {
      onStep: (done, total) => steps.push({ done, total }),
    })

    const last = steps.at(-1)
    expect(last?.done).toBe(last?.total)
  })

  /**
   * A rush larger than a write stream's buffer, which is what every real one is: the sink refuses
   * more, and a reader that waits on a drain the stream will never emit stops for good.
   */
  it('reads a medium bigger than the disk buffer through to the end', async () => {
    const heavy = new Uint8Array(1_500_000).fill(0x42)

    const read = await readOtiozFile(await ours([{ name: 'plan.mp4', bytes: heavy }]), into)

    expect(read?.media.map(one => one.file)).toEqual(['plan.mp4'])
    expect((await stat(join(into, 'plan.mp4'))).size).toBe(heavy.length)
  })

  /**
   * A disk that refuses the rush names itself rather than killing the process every bundle shares.
   * Its ASSERTION is blind to the listener — the rejection arrives either way; what takes the run
   * down without one is the uncaught exception, so this case only holds at the run's exit code.
   */
  it('names the fault when a medium cannot be written', async () => {
    await mkdir(join(into, 'plan.mp4'))

    await expect(
      readOtiozFile(await ours([{ name: 'plan.mp4', bytes: RUSH }]), into),
    ).rejects.toThrow(/EISDIR/)
  })

  it('answers nothing for a stop that arrived before it began, and unpacks nothing', async () => {
    const read = await readOtiozFile(await ours([{ name: 'plan.mp4', bytes: RUSH }]), into, {
      signal: AbortSignal.abort(),
    })

    expect(read).toBeNull()
    expect(await readdir(into)).toEqual([])
  })
})

describe('an archive from anywhere else', () => {
  /**
   * `media/../../.bashrc` unpacked is the same file the writing side already refuses to emit, by
   * the other door. Refused WHOLE: an archive trying to write outside itself is hostile, and
   * unpacking the rest would leave somebody a montage that opened fine.
   */
  it('refuses one whose entry would land outside the folder, and unpacks none of it', async () => {
    const archive = await handMade({
      [OTIOZ_VERSION_PATH]: OTIOZ_VERSION,
      [OTIOZ_CONTENT_PATH]: CONTENT,
      'media/plan.mp4': RUSH,
      'media/../../escaped.txt': 'owned',
    })

    await expect(readOtiozFile(archive, into)).rejects.toThrow(BundleEscapeError)
  })

  it('leaves an entry that claims to be no medium alone, rather than refusing the bundle', async () => {
    const read = await readOtiozFile(
      await handMade({
        [OTIOZ_VERSION_PATH]: OTIOZ_VERSION,
        [OTIOZ_CONTENT_PATH]: CONTENT,
        'notes/readme.txt': 'another application put this here',
      }),
      into,
    )

    expect(read?.content).toBe(CONTENT)
    expect(await readdir(into)).toEqual([])
  })

  it('refuses a zip that carries no cut', async () => {
    const archive = await handMade({ [OTIOZ_VERSION_PATH]: OTIOZ_VERSION, 'media/plan.mp4': RUSH })

    await expect(readOtiozFile(archive, into)).rejects.toThrow(NotABundleError)
  })

  /** Refused rather than guessed at: a layout this reader has never seen is not one it can walk. */
  it('refuses a major version it does not know', async () => {
    const archive = await handMade({
      [OTIOZ_VERSION_PATH]: '2.0.0',
      [OTIOZ_CONTENT_PATH]: CONTENT,
    })

    await expect(readOtiozFile(archive, into)).rejects.toThrow(NotABundleError)
  })

  it('reads a bundle whose media were deflated rather than stored', async () => {
    const archive = join(folder, 'Deflated.otioz')
    await writeFile(
      archive,
      zipSync(
        {
          [OTIOZ_VERSION_PATH]: strToU8(OTIOZ_VERSION),
          [OTIOZ_CONTENT_PATH]: strToU8(CONTENT),
          'media/plan.mp4': RUSH,
        },
        { level: 6 },
      ),
    )

    const read = await readOtiozFile(archive, into)

    expect(read?.media.map(one => one.file)).toEqual(['plan.mp4'])
    expect(new Uint8Array(await readFile(join(into, 'plan.mp4')))).toEqual(RUSH)
  })
})
