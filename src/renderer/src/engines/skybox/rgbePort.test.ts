import { describe, expect, it, vi } from 'vitest'

/** jsdom has no `Worker`; the module builds one at import, so the class is stood in for. */
const posted: { message: unknown; options: unknown }[] = []
const listeners = new Map<string, (event: unknown) => void>()
const terminate = vi.fn()

vi.mock('./rgbe.worker?worker', () => ({
  default: class {
    addEventListener(name: string, handler: (event: unknown) => void) {
      listeners.set(name, handler)
    }
    postMessage(message: unknown, options: unknown) {
      posted.push({ message, options })
    }
    terminate = terminate
  },
}))

const { encodeRgbeOffThread } = await import('./rgbePort')

const answer = (data: unknown): void => listeners.get('message')?.({ data })

describe('radiance encoding off the thread', () => {
  /**
   * TRANSFERRED and not copied, which is the whole point of moving it: the readback is 64 MiB at
   * 4K, and a structured clone would put a second one on the worker's side of the wire.
   */
  it('hands the readback over rather than copying it', async () => {
    const half = new Uint16Array(8)

    const encoding = encodeRgbeOffThread(half, 2, 1)
    answer({ file: new Uint8Array([1]) })
    await encoding

    expect(posted[0]?.message).toEqual({ half, width: 2, height: 1 })
    expect(posted[0]?.options).toEqual({ transfer: [half.buffer] })
  })

  it('answers the bytes the worker built', async () => {
    const encoding = encodeRgbeOffThread(new Uint16Array(4), 1, 1)
    answer({ file: new Uint8Array([7, 8]) })

    await expect(encoding).resolves.toEqual(new Uint8Array([7, 8]))
  })

  /** A worker left alive holds a thread and its buffers; an export is a rare, heavy gesture. */
  it('ends the worker whether it answered or threw', async () => {
    terminate.mockClear()

    const encoding = encodeRgbeOffThread(new Uint16Array(4), 1, 1)
    answer({ failure: 'no room' })

    await expect(encoding).rejects.toThrow('no room')
    expect(terminate).toHaveBeenCalledTimes(1)
  })

  /**
   * A worker that dies takes its promise with it. Without this the export hangs for good — the
   * defect this repository already paid for on the bundle reader.
   */
  it('rejects when the worker dies rather than waiting for an answer that cannot come', async () => {
    const encoding = encodeRgbeOffThread(new Uint16Array(4), 1, 1)
    listeners.get('error')?.({ message: 'worker gone' })

    await expect(encoding).rejects.toThrow('worker gone')
  })
})
