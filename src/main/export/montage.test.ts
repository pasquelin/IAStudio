import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerMontageHandlers } from './montage'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const data = new TextEncoder().encode('{"OTIO_SCHEMA":"Timeline.1"}')

describe('the montage export handler', () => {
  let folder: string
  let pickSavePath: (name: string, extension: string) => Promise<string | null>

  beforeEach(async () => {
    resetHandlers()
    folder = await mkdtemp(join(tmpdir(), 'scenario-otio-'))
    pickSavePath = vi.fn((name: string, extension: string) =>
      Promise.resolve(join(folder, `${name}${extension}`)),
    )
    registerMontageHandlers({ pickSavePath })
  })

  it('writes the cut where the dialog landed, under the one extension it writes', async () => {
    await expect(invoke(CHANNELS.montageExport, { name: 'Bande', data })).resolves.toBe(
      'Bande.otio',
    )

    expect(pickSavePath).toHaveBeenCalledWith('Bande', '.otio')
    await expect(readFile(join(folder, 'Bande.otio'))).resolves.toEqual(Buffer.from(data))
  })

  it('writes nothing at all when the dialog was dismissed', async () => {
    registerMontageHandlers({ pickSavePath: () => Promise.resolve(null) })

    await expect(invoke(CHANNELS.montageExport, { name: 'Bande', data })).resolves.toBeNull()
  })

  // The renderer is the sandboxed side, and a name carrying a separator is a write outside the
  // folder the user picked.
  it('refuses a name that would leave the folder the dialog chose', async () => {
    await expect(invoke(CHANNELS.montageExport, { name: '../escape', data })).rejects.toThrow()
  })
})
