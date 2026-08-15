import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { nodeFontDisk } from './disk'

/**
 * The one file in the font work that talks to a real disk, so it is read against one — a fake
 * would agree with whatever this file assumes, and what is being guarded here is precisely an
 * assumption about what Node does with a length a font file made up.
 */
const opened: { close: () => Promise<void> }[] = []

async function fileOf(bytes: Uint8Array): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'scenario-fonts-'))
  const path = join(folder, 'face.ttf')
  await writeFile(path, bytes)
  return path
}

async function open(path: string) {
  const file = await nodeFontDisk.open(path)
  opened.push(file)
  return file
}

afterEach(async () => {
  for (const file of opened.splice(0)) await file.close()
})

describe('reading a font file by ranges', () => {
  it('answers the bytes that were asked for', async () => {
    const file = await open(await fileOf(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])))

    expect(await file.read(2, 3)).toEqual(Uint8Array.from([3, 4, 5]))
  })

  it('answers short when the file ends first, which is what a truncated font is', async () => {
    const file = await open(await fileOf(Uint8Array.from([1, 2, 3, 4])))

    expect(await file.read(2, 100)).toEqual(Uint8Array.from([3, 4]))
  })

  /**
   * The length asked for always comes out of a field inside the font, and Node's own binding
   * *asserts* that it fits in a signed 32-bit integer — a corrupt table entry with its high bit
   * set aborts the process below the level any `catch` can reach, taking every window with it.
   * One such file in `~/Library/Fonts` would stop the studio from starting.
   */
  it('survives a length no read could ever satisfy', async () => {
    const file = await open(await fileOf(Uint8Array.from([1, 2, 3, 4])))

    expect(await file.read(0, 2 ** 31)).toEqual(Uint8Array.from([1, 2, 3, 4]))
    expect(await file.read(0, Number.MAX_SAFE_INTEGER)).toHaveLength(4)
  })

  it.each([
    ['a length of nothing', 0, 0],
    ['a negative length', 0, -1],
    ['an offset past the end', 100, 4],
    ['a negative offset', -1, 4],
  ])('answers nothing for %s', async (_case, at, length) => {
    const file = await open(await fileOf(Uint8Array.from([1, 2, 3, 4])))

    expect(await file.read(at, length)).toHaveLength(0)
  })
})

describe('listing a font folder', () => {
  it('answers nothing for a folder the machine has not got', async () => {
    await expect(nodeFontDisk.list(join(tmpdir(), 'scenario-fonts-nowhere'))).rejects.toThrow()
  })
})
