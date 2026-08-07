import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerDialogHandlers } from './dialogs'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

describe('the path picker handler', () => {
  let pickPath: (kind: string, startIn?: string) => Promise<string | null>

  beforeEach(() => {
    resetHandlers()
    pickPath = vi.fn(() => Promise.resolve('/opt/homebrew/bin/ffmpeg'))
    registerDialogHandlers({ pickPath })
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
