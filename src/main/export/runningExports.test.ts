import { describe, expect, it } from 'vitest'
import { createRunningExports } from './runningExports'

describe('the table of running exports', () => {
  it('stops the one the window names, and leaves the others turning', async () => {
    const table = createRunningExports()
    const stopped: string[] = []

    const watch = (id: string) => (signal: AbortSignal) =>
      new Promise<void>(resolve => {
        signal.addEventListener('abort', () => {
          stopped.push(id)
          resolve()
        })
      })

    const first = table.run('a', watch('a'))
    const second = table.run('b', watch('b'))

    expect(table.cancel('a')).toBe(true)
    await first

    expect(stopped).toEqual(['a'])
    expect(table.cancel('b')).toBe(true)
    await second
  })

  /** A click that arrives after the file was written is late, not wrong. */
  it('says nothing was stopped once the export has ended', async () => {
    const table = createRunningExports()
    await table.run('a', () => Promise.resolve())

    expect(table.cancel('a')).toBe(false)
  })

  /**
   * The second would take over the stop button of the first, which then becomes unstoppable —
   * and the first to end would delete the second's entry.
   */
  it('refuses a second export under a name already running', async () => {
    const table = createRunningExports()
    const held = table.run('a', () => new Promise<void>(() => {}))

    await expect(table.run('a', () => Promise.resolve())).rejects.toThrow('already running')

    // The first is untouched: its name still answers.
    expect(table.cancel('a')).toBe(true)
    void held
  })

  it('forgets an export that ended badly, so its name can be used again', async () => {
    const table = createRunningExports()

    await expect(table.run('a', () => Promise.reject(new Error('disk full')))).rejects.toThrow()
    await expect(table.run('a', () => Promise.resolve('done'))).resolves.toBe('done')
  })
})
