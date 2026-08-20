import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openForkedWorker } from './forkedWorker'

/** The child a fork hands back, reduced to what the port does with it. */
const child = vi.hoisted(() => {
  const state = {
    forked: [] as string[],
    exit: null as ((code: number) => void) | null,
    on: (channel: string, listener: (code: number) => void): void => {
      if (channel === 'exit') state.exit = listener
    },
    postMessage: (): void => {},
    kill: (): void => {},
  }

  return state
})

vi.mock('electron', () => ({
  utilityProcess: {
    fork: (path: string) => {
      child.forked.push(path)
      return child
    },
  },
}))

let gone = 0

const open = () =>
  openForkedWorker<{ ask: string }, { answer: string }>({
    entry: new URL('file:///out/main/peaksWorker.js'),
    processName: 'waveform process',
    onExit: () => {
      gone += 1
    },
  })

beforeEach(() => {
  child.forked.length = 0
  child.exit = null
  gone = 0
})

describe('a forked worker', () => {
  // `utilityProcess.fork` takes a path, and the entry is resolved as a URL: a `file://` handed
  // over whole forks a worker nothing can find.
  it('forks the entry as a path on disk', () => {
    open()

    expect(child.forked).toEqual(['/out/main/peaksWorker.js'])
  })

  it('turns any exit, clean or not, into a failure naming the process', () => {
    const failures: Error[] = []
    open().onFailure(error => failures.push(error))

    child.exit?.(0)

    expect(failures.map(error => error.message)).toEqual(['waveform process exited with code 0'])
  })

  it('tells whoever holds the worker that the process is gone', () => {
    open().onFailure(() => {})

    child.exit?.(9)

    expect(gone).toBe(1)
  })
})
