import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { beforeEach, describe, expect, it } from 'vitest'
import { MissingMediumError, writeOtiozFile } from './otiozFile'

let folder: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'scenario-otioz-'))
})

const CONTENT = '{"OTIO_SCHEMA":"Timeline.1","name":"Montage"}'

/** Four bytes no deflate would leave alone, so « stored » is visible in the file's own size. */
const RUSH = new Uint8Array(4096).fill(0x41)

async function bundleWith(media: { name: string; bytes: Uint8Array }[]): Promise<string> {
  const paths = []
  for (const one of media) {
    const path = join(folder, one.name)
    await writeFile(path, one.bytes)
    paths.push({ source: `file://${path}`, entry: `media/${one.name}`, path })
  }

  const bundle = join(folder, 'Montage.otioz')
  await writeOtiozFile(bundle, { content: CONTENT, media: paths })
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
