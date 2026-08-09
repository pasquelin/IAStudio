import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerTextureHandlers } from './export'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46])

const file = (name: string, extension = '.png', bytes = png): unknown => ({
  name,
  extension,
  bytes,
})

describe('the texture export handler', () => {
  let chosen: string
  let pickFolder: () => Promise<string | null>

  beforeEach(async () => {
    resetHandlers()
    chosen = await mkdtemp(join(tmpdir(), 'scenario-texture-'))
    pickFolder = vi.fn(() => Promise.resolve<string | null>(chosen))
    registerTextureHandlers({ pickFolder })
  })

  it('writes every file into a folder named after the texture', async () => {
    await invoke(CHANNELS.textureExport, {
      folder: 'Brique',
      files: [file('Brique_BaseColor'), file('Brique_ORM')],
    })

    await expect(readdir(join(chosen, 'Brique'))).resolves.toEqual([
      'Brique_BaseColor.png',
      'Brique_ORM.png',
    ])
  })

  it('writes the bytes it was handed, not a re-encoding of them', async () => {
    await invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('Brique_BaseColor')] })

    await expect(readFile(join(chosen, 'Brique', 'Brique_BaseColor.png'))).resolves.toEqual(
      Buffer.from(png),
    )
  })

  it('gives each file the extension it arrived with', async () => {
    await invoke(CHANNELS.textureExport, {
      folder: 'Brique',
      files: [file('Brique', '.glb', glb)],
    })

    await expect(readdir(join(chosen, 'Brique'))).resolves.toEqual(['Brique.glb'])
  })

  // The name, never the path: where a folder sits is this side's business.
  it('answers the name of the folder it filled', async () => {
    await expect(
      invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('Brique_BaseColor')] }),
    ).resolves.toBe('Brique')
  })

  it('writes nothing when the dialog was dismissed', async () => {
    pickFolder = () => Promise.resolve(null)
    resetHandlers()
    registerTextureHandlers({ pickFolder })

    await expect(
      invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('Brique_BaseColor')] }),
    ).resolves.toBeNull()
    await expect(readdir(chosen)).resolves.toEqual([])
  })

  /** Re-exporting after a change is the ordinary case, and it must not fail on the second go. */
  it('writes over a folder it already filled', async () => {
    const twice = { folder: 'Brique', files: [file('Brique_BaseColor')] }
    await invoke(CHANNELS.textureExport, twice)

    await expect(invoke(CHANNELS.textureExport, twice)).resolves.toBe('Brique')
  })

  describe('refuses what the sandboxed side must not decide', () => {
    it('a folder that would climb out of the one that was picked', async () => {
      await expect(
        invoke(CHANNELS.textureExport, { folder: '../escape', files: [file('a')] }),
      ).rejects.toThrow()
      await expect(
        invoke(CHANNELS.textureExport, { folder: '..', files: [file('a')] }),
      ).rejects.toThrow()
    })

    it('a file name carrying a separator', async () => {
      await expect(
        invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('sub/base')] }),
      ).rejects.toThrow()
      await expect(
        invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('..\\base')] }),
      ).rejects.toThrow()
    })

    it('an extension no target writes', async () => {
      await expect(
        invoke(CHANNELS.textureExport, { folder: 'Brique', files: [file('base', '.exe')] }),
      ).rejects.toThrow()
    })

    it('anything that is not bytes', async () => {
      await expect(
        invoke(CHANNELS.textureExport, {
          folder: 'Brique',
          files: [{ name: 'base', extension: '.png', bytes: 'not bytes' }],
        }),
      ).rejects.toThrow()
    })

    it('an export with no file in it at all', async () => {
      await expect(
        invoke(CHANNELS.textureExport, { folder: 'Brique', files: [] }),
      ).rejects.toThrow()
    })

    it('more files than the widest target writes', async () => {
      const many = Array.from({ length: 17 }, (_unused, index) => file(`base-${index}`))

      await expect(
        invoke(CHANNELS.textureExport, { folder: 'Brique', files: many }),
      ).rejects.toThrow()
    })

    it('a set of files too large to be an export', async () => {
      const files = Array.from({ length: 5 }, (_unused, index) => {
        const bytes = new Uint8Array(0)
        Object.defineProperty(bytes, 'byteLength', { value: 200 * 1024 * 1024 })
        return { name: `base-${index}`, extension: '.png', bytes }
      })

      await expect(invoke(CHANNELS.textureExport, { folder: 'Brique', files })).rejects.toThrow()
    })

    /** The ceiling is on the whole export, so one file over it is refused by the same rule. */
    it('a single file that is over the ceiling on its own', async () => {
      const bytes = new Uint8Array(0)
      Object.defineProperty(bytes, 'byteLength', { value: 513 * 1024 * 1024 })

      await expect(
        invoke(CHANNELS.textureExport, {
          folder: 'Brique',
          files: [{ name: 'base', extension: '.png', bytes }],
        }),
      ).rejects.toThrow()
    })
  })

  it('never opens a dialog for a request it refuses', async () => {
    await expect(
      invoke(CHANNELS.textureExport, { folder: '../escape', files: [file('a')] }),
    ).rejects.toThrow()

    expect(pickFolder).not.toHaveBeenCalled()
  })
})
