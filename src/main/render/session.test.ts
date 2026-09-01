import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startRender } from './session'

const staged: string[] = []

async function scratch(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'scenario-render-test-'))
  staged.push(folder)
  return folder
}

afterEach(async () => {
  for (const folder of staged.splice(0)) await rm(folder, { recursive: true, force: true })
})

const png = (byte: number) => new Uint8Array([byte])

/** The folder a session staged into, read back off the arguments it handed the encoder. */
function folderOf(args: readonly string[]): string {
  const input = args[args.indexOf('-i') + 1] ?? ''
  return input.slice(0, input.lastIndexOf('/'))
}

describe('a render staged on disk', () => {
  it('writes one file per frame, named in the order ffmpeg reads them', async () => {
    const encode = vi.fn(() => Promise.resolve())
    const session = await startRender({ encode, scratch })

    await session.frame(1, png(1))
    await session.frame(2, png(2))

    const folder = staged[0]
    if (!folder) throw new Error('the fixture staged one folder')
    expect((await readdir(folder)).sort()).toEqual(['frame_000001.png', 'frame_000002.png'])

    await session.cancel()
  })

  it('hands the encoder the pattern of the folder it staged, and the asked rate', async () => {
    const encode = vi.fn((_args: readonly string[]) => Promise.resolve())
    const session = await startRender({ encode, scratch })

    await session.frame(1, png(1))
    await session.finish('/out/film.mp4', 30)

    const args: readonly string[] = encode.mock.calls[0]?.[0] ?? []
    expect(args[args.indexOf('-framerate') + 1]).toBe('30')
    expect(args.at(-1)).toBe('/out/film.mp4')
    expect(folderOf(args)).toBe(staged[0])
  })

  it('clears the staged frames once the film is written', async () => {
    const session = await startRender({ encode: () => Promise.resolve(), scratch })
    await session.frame(1, png(1))
    await session.finish('/out/film.mp4', 25)

    await expect(stat(staged[0] ?? '')).rejects.toThrow()
  })

  /** Megabytes nobody will look at: a failed encode must not leave them behind. */
  it('clears them even when the encoder refuses', async () => {
    const session = await startRender({
      encode: () => Promise.reject(new Error('no such encoder')),
      scratch,
    })
    await session.frame(1, png(1))

    await expect(session.finish('/out/film.mp4', 25)).rejects.toThrow('no such encoder')
    await expect(stat(staged[0] ?? '')).rejects.toThrow()
  })

  it('throws the frames away on a cancel, without encoding anything', async () => {
    const encode = vi.fn(() => Promise.resolve())
    const session = await startRender({ encode, scratch })
    await session.frame(1, png(1))

    await session.cancel()

    expect(encode).not.toHaveBeenCalled()
    await expect(stat(staged[0] ?? '')).rejects.toThrow()
  })

  it('takes a second cancel without complaining', async () => {
    const session = await startRender({ encode: () => Promise.resolve(), scratch })
    await session.cancel()
    await expect(session.cancel()).resolves.toBeUndefined()
  })

  it('aborts an encode still running, so Stop does not wait for ffmpeg', async () => {
    let signal: AbortSignal | undefined
    const encode = vi.fn(
      (_args: readonly string[], next?: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal = next
          next?.addEventListener('abort', () =>
            queueMicrotask(() => reject(new Error('cancelled'))),
          )
        }),
    )
    const session = await startRender({ encode, scratch })
    await session.frame(1, png(1))

    const finishing = session.finish('/out/film.mp4', 25).catch((error: unknown) => error)
    await session.cancel()

    expect(signal?.aborted).toBe(true)
    await expect(finishing).resolves.toEqual(new Error('cancelled'))
  })
})
