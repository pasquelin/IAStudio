import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerDialogHandlers } from './dialogs'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const savePicture = vi.fn<(name: string, bytes: Uint8Array) => Promise<string | null>>(() =>
  Promise.resolve('/Users/someone/Pictures/canvas.png'),
)

describe('the path picker handler', () => {
  let pickPath: (kind: string, startIn?: string) => Promise<string | null>

  beforeEach(() => {
    resetHandlers()
    pickPath = vi.fn(() => Promise.resolve('/opt/homebrew/bin/ffmpeg'))
    registerDialogHandlers({ pickPath, savePicture })
  })

  it('opens the picker the caller asked for', async () => {
    await expect(invoke(CHANNELS.dialogPickPath, 'file')).resolves.toBe('/opt/homebrew/bin/ffmpeg')
    expect(pickPath).toHaveBeenCalledWith('file', undefined)
  })

  // The projects folder is what makes a "where projects go" setting mean anything.
  it('opens where the caller asked it to start', async () => {
    await invoke(CHANNELS.dialogPickPath, 'folder', '/Users/someone/Projects')

    expect(pickPath).toHaveBeenCalledWith('folder', '/Users/someone/Projects')
  })

  // The value decides which native picker opens, and a renderer is what sends it.
  it('refuses a kind that is not one of the two', () => {
    expect(() => invoke(CHANNELS.dialogPickPath, 'network')).toThrow()
    expect(pickPath).not.toHaveBeenCalled()
  })
})

describe('the picture export handler', () => {
  beforeEach(() => {
    resetHandlers()
    savePicture.mockClear()
    registerDialogHandlers({ pickPath: () => Promise.resolve(null), savePicture })
  })

  // Decoded here rather than in the renderer: a Buffer does not cross the bridge.
  it('decodes the payload and hands the bytes to the writer', async () => {
    // "AB" in base64.
    await invoke(CHANNELS.dialogExportPicture, 'canvas.png', 'QUI=')

    const [name, bytes] = savePicture.mock.calls[0] ?? []
    expect(name).toBe('canvas.png')
    expect(Array.from(bytes ?? [])).toEqual([65, 66])
  })

  it('hands back where the picture was written', async () => {
    await expect(invoke(CHANNELS.dialogExportPicture, 'canvas.png', 'QUI=')).resolves.toBe(
      '/Users/someone/Pictures/canvas.png',
    )
  })

  // A separator here would write outside the folder the dialog picked.
  it('refuses a name that is a path', () => {
    expect(() => invoke(CHANNELS.dialogExportPicture, '../escape.png', 'QUI=')).toThrow()
    expect(savePicture).not.toHaveBeenCalled()
  })

  // A data URL prefix would be written into the file as if it were pixels.
  it('refuses a data URL', () => {
    expect(() =>
      invoke(CHANNELS.dialogExportPicture, 'canvas.png', 'data:image/png;base64,QUI='),
    ).toThrow()
  })
})
