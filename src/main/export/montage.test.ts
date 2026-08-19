import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerMontageHandlers } from './montage'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const CONTENT = '{"OTIO_SCHEMA":"Timeline.1"}'

describe('the montage export handler', () => {
  let folder: string
  let pickSavePath: (name: string, extension: string) => Promise<string | null>

  beforeEach(async () => {
    resetHandlers()
    folder = await mkdtemp(join(tmpdir(), 'scenario-otio-'))
    pickSavePath = vi.fn((name: string, extension: string) =>
      Promise.resolve(join(folder, `${name}${extension}`)),
    )
    registerMontageHandlers({ pickSavePath, projectPath: () => null })
  })

  it('writes the cut where the dialog landed, under the extension its target writes', async () => {
    await expect(
      invoke(CHANNELS.montageExport, {
        name: 'Bande',
        target: 'montage.otio',
        content: CONTENT,
      }),
    ).resolves.toBe('Bande.otio')

    expect(pickSavePath).toHaveBeenCalledWith('Bande', '.otio')
    await expect(readFile(join(folder, 'Bande.otio'), 'utf8')).resolves.toBe(CONTENT)
  })

  it('writes nothing at all when the dialog was dismissed', async () => {
    registerMontageHandlers({ pickSavePath: () => Promise.resolve(null), projectPath: () => null })

    await expect(
      invoke(CHANNELS.montageExport, {
        name: 'Bande',
        target: 'montage.otio',
        content: CONTENT,
      }),
    ).resolves.toBeNull()
  })

  // The renderer is the sandboxed side, and a name carrying a separator is a write outside the
  // folder the user picked.
  it('refuses a name that would leave the folder the dialog chose', async () => {
    await expect(
      invoke(CHANNELS.montageExport, {
        name: '../escape',
        target: 'montage.otio',
        content: CONTENT,
      }),
    ).rejects.toThrow()
  })

  it('refuses a target that belongs to another section', async () => {
    await expect(
      invoke(CHANNELS.montageExport, {
        name: 'Bande',
        target: 'scene.usdz',
        content: CONTENT,
      }),
    ).rejects.toThrow()
  })
})

describe('the same cut, bundled with the media it points at', () => {
  let project: string
  let out: string
  let rush: string

  beforeEach(async () => {
    resetHandlers()
    project = await realpath(await mkdtemp(join(tmpdir(), 'scenario-project-')))
    out = await mkdtemp(join(tmpdir(), 'scenario-out-'))
    rush = join(project, 'plan.mp4')
    await writeFile(rush, new Uint8Array(2048).fill(9))

    registerMontageHandlers({
      pickSavePath: (name, extension) => Promise.resolve(join(out, `${name}${extension}`)),
      projectPath: () => project,
    })
  })

  const bundling = (source: string): unknown => ({
    name: 'Bande',
    target: 'montage.otioz',
    content: CONTENT,
    media: [{ source, entry: 'media/plan.mp4' }],
  })

  it('writes a bundle holding the cut and the medium', async () => {
    await expect(invoke(CHANNELS.montageExport, bundling(`file://${rush}`))).resolves.toBe(
      'Bande.otioz',
    )

    const entries = unzipSync(await readFile(join(out, 'Bande.otioz')))
    expect(Object.keys(entries)).toEqual(['version.txt', 'content.otio', 'media/plan.mp4'])
  })

  /**
   * The paths never cross back, and this is why: the renderer names what to read, so a montage
   * pointing anywhere would have that file packed into something handed to somebody else.
   */
  it('refuses a medium that sits outside the open project', async () => {
    const elsewhere = join(await mkdtemp(join(tmpdir(), 'scenario-elsewhere-')), 'secret.mp4')
    await writeFile(elsewhere, new Uint8Array([1, 2, 3]))

    await expect(invoke(CHANNELS.montageExport, bundling(`file://${elsewhere}`))).rejects.toThrow()
    await expect(readFile(join(out, 'Bande.otioz'))).rejects.toThrow()
  })

  /**
   * The entry becomes a path inside the archive, and the renderer names it. Unchecked, the studio
   * writes a zip-slip file of its own making and hands it to somebody else.
   */
  it('refuses an entry that would climb out of the bundle', async () => {
    await expect(
      invoke(CHANNELS.montageExport, {
        name: 'Bande',
        target: 'montage.otioz',
        content: CONTENT,
        media: [{ source: `file://${rush}`, entry: 'media/../../.bashrc' }],
      }),
    ).rejects.toThrow()
  })

  it('refuses two media asking for the same entry, one pixel set landing under the other', async () => {
    await expect(
      invoke(CHANNELS.montageExport, {
        name: 'Bande',
        target: 'montage.otioz',
        content: CONTENT,
        media: [
          { source: `file://${rush}`, entry: 'media/plan.mp4' },
          { source: `file://${rush}`, entry: 'media/plan.mp4' },
        ],
      }),
    ).rejects.toThrow()
  })

  it('refuses a medium the cut names and the project does not hold', async () => {
    await expect(
      invoke(CHANNELS.montageExport, bundling(`file://${join(project, 'absent.mp4')}`)),
    ).rejects.toThrow()
  })

  // Without one there is nothing to resolve a medium against, and every path would be refused
  // one by one for a reason that is not the real one.
  it('writes nothing when no project is open', async () => {
    resetHandlers()
    registerMontageHandlers({
      pickSavePath: (name, extension) => Promise.resolve(join(out, `${name}${extension}`)),
      projectPath: () => null,
    })

    await expect(invoke(CHANNELS.montageExport, bundling(`file://${rush}`))).resolves.toBeNull()
  })
})
