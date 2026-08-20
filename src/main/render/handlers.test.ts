import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/testHarness'
import { registerRenderHandlers } from './handlers'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

const staged: string[] = []

async function scratch(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'scenario-render-handler-'))
  staged.push(folder)
  return folder
}

afterEach(async () => {
  for (const folder of staged.splice(0)) await rm(folder, { recursive: true, force: true })
})

const png = new Uint8Array([137, 80, 78, 71])

type Harness = {
  encode: ReturnType<typeof vi.fn>
  pickSavePath: ReturnType<typeof vi.fn>
}

function install(saveTo: string | null = '/films/set.mp4'): Harness {
  const encode = vi.fn((_args: readonly string[]) => Promise.resolve())
  const pickSavePath = vi.fn(() => Promise.resolve(saveTo))
  let minted = 0

  registerRenderHandlers({
    encode,
    scratch,
    pickSavePath,
    newId: () => `render_${(minted += 1)}`,
  })
  return { encode, pickSavePath }
}

const start = (name = 'Set dressing', fps = 25): Promise<string | null> =>
  invoke(CHANNELS.renderStart, { name, fps }) as Promise<string | null>

beforeEach(resetHandlers)

describe('rendering a scene to a film', () => {
  it('asks where it goes BEFORE a single frame is computed', async () => {
    const { pickSavePath } = install()
    const id = await start()

    expect(pickSavePath).toHaveBeenCalledWith('Set dressing', '.mp4')
    expect(id).toBe('render_1')
  })

  it('answers nothing when the save dialog is dismissed, so nothing is computed for nobody', async () => {
    install(null)
    expect(await start()).toBeNull()
  })

  it('stages the frames, then encodes them at the rate it was opened with', async () => {
    const { encode } = install()
    const id = await start('Set dressing', 30)

    await invoke(CHANNELS.renderFrame, { id, index: 1, png })
    const name = await invoke(CHANNELS.renderFinish, id)

    const args: readonly string[] = encode.mock.calls[0]?.[0] ?? []
    expect(args[args.indexOf('-framerate') + 1]).toBe('30')
    // The name, never the path: where a file sits is the main process's business.
    expect(name).toBe('set.mp4')
  })

  /** Frames are in flight when a cancel lands; each of them reporting a failure is noise. */
  it('drops a frame for a session that is over, rather than failing', async () => {
    install()
    const id = await start()
    await invoke(CHANNELS.renderCancel, id)

    await expect(invoke(CHANNELS.renderFrame, { id, index: 1, png })).resolves.toBeUndefined()
  })

  it('throws the staged frames away on a cancel, and encodes nothing', async () => {
    const { encode } = install()
    const id = await start()
    await invoke(CHANNELS.renderFrame, { id, index: 1, png })

    await invoke(CHANNELS.renderCancel, id)

    expect(encode).not.toHaveBeenCalled()
    await expect(stat(staged[0] ?? '')).rejects.toThrow()
  })

  it('answers nothing when asked to finish a session it does not hold', async () => {
    install()
    expect(await invoke(CHANNELS.renderFinish, 'render_nobody')).toBeNull()
  })

  it('refuses a rate no film runs at', async () => {
    install()
    await expect(start('Set', 0)).rejects.toThrow()
    await expect(start('Set', 1000)).rejects.toThrow()
  })

  it('refuses a name that would climb out of the folder it is handed', async () => {
    install()
    await expect(start('../../etc/passwd', 25)).rejects.toThrow()
  })

  // The same climb without a separator to give it away, which this channel used to let through.
  it('refuses the name of the folder above', async () => {
    install()
    await expect(start('..', 25)).rejects.toThrow()
  })

  it('keeps two renders apart', async () => {
    const { encode } = install()
    const first = await start('First', 25)
    const second = await start('Second', 25)

    expect(first).not.toBe(second)
    await invoke(CHANNELS.renderFrame, { id: first, index: 1, png })
    await invoke(CHANNELS.renderFinish, first)
    await invoke(CHANNELS.renderCancel, second)

    expect(encode).toHaveBeenCalledTimes(1)
  })
})
