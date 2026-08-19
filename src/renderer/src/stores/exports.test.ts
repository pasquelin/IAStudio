import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExportWriteProgress } from '@shared/domain/exportProgress'
import { installFakeBridge } from '@/services/fakeBridge'
import { runExport, useExports } from './exports'

beforeEach(() => {
  useExports.setState({ running: {} })
  installFakeBridge()
})

describe('an export in flight', () => {
  it('shows a row for as long as it runs, and takes it away when it ends', async () => {
    let release = (): void => {}
    const running = runExport(
      'Coucher',
      () =>
        new Promise<string>(resolve => {
          release = () => resolve('Coucher')
        }),
    )

    expect(Object.values(useExports.getState().running)).toEqual([
      expect.objectContaining({ label: 'Coucher', ratio: 0 }),
    ])

    release()
    await expect(running).resolves.toBe('Coucher')
    expect(useExports.getState().running).toEqual({})
  })

  it('moves the needle as the work reports it', async () => {
    const seen: number[] = []

    await runExport('Coucher', (_id, watch) => {
      watch.onStep?.(3, 6)
      seen.push(Object.values(useExports.getState().running)[0]?.ratio ?? -1)
      return Promise.resolve(null)
    })

    expect(seen).toEqual([0.5])
  })

  /** A failure is reported by whoever asked; a row left behind would be a bar nothing removes. */
  it('takes the row away when the work throws, and lets the failure through', async () => {
    await expect(
      runExport('Coucher', () => Promise.reject(new Error('no channel'))),
    ).rejects.toThrow('no channel')

    expect(useExports.getState().running).toEqual({})
  })
})

describe('stopping one', () => {
  it('aborts the work here and tells the main process, under the same name', async () => {
    const cancel = vi.fn(() => Promise.resolve(true))
    installFakeBridge({ exports: { cancel } })

    const seen: AbortSignal[] = []
    const running = runExport('Bande', (_id, watch) => {
      if (watch.signal) seen.push(watch.signal)
      return new Promise<string>(() => {})
    })

    const [row] = Object.values(useExports.getState().running)
    useExports.getState().cancelExport(row?.id ?? '')

    expect(seen[0]?.aborted).toBe(true)
    expect(cancel).toHaveBeenCalledWith(row?.id)
    void running
  })

  /**
   * A stop is a decision, not a fault: answering `null` is what every caller here already
   * answers for a dismissed dialog, so nothing downstream has to learn a second shape.
   */
  it('answers nothing rather than the throw the loop unwound with', async () => {
    const running = runExport(
      'Coucher',
      (_id, watch) =>
        new Promise<string>((_resolve, reject) => {
          watch.signal?.addEventListener('abort', () => reject(new Error('aborted mid-face')))
        }),
    )

    const [row] = Object.values(useExports.getState().running)
    useExports.getState().cancelExport(row?.id ?? '')

    await expect(running).resolves.toBeNull()
    expect(useExports.getState().running).toEqual({})
  })
})

describe('what the main process reports', () => {
  /**
   * The last chunk of a bundle and its answer cross: a row re-created by a late step would sit
   * at 100 % for the rest of the session with nothing left to remove it.
   */
  it('ignores a step for an export that has already ended', () => {
    let push = (_progress: ExportWriteProgress): void => {}
    installFakeBridge({
      exports: {
        onProgress: callback => {
          push = callback
          return () => {}
        },
      },
    })

    const stop = useExports.getState().connect()
    push({ id: 'gone', ratio: 0.5 })

    expect(useExports.getState().running).toEqual({})
    stop()
  })
})
