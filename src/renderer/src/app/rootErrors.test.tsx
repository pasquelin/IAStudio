import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { forgetReportedFailures } from '@/services/diagnostics'
import { bridgeWatchingLogs } from '@/services/fakeBridge'
import { ROOT_ERROR_REPORTING, traceDroppedRejections } from './rootErrors'

function Boom(): never {
  throw new Error('panel exploded')
}

beforeEach(forgetReportedFailures)

describe('ROOT_ERROR_REPORTING', () => {
  /**
   * Through a real tree rather than by calling the hook: this is the whole chain — a component
   * throws, a boundary catches, the root reports, the entry crosses to the process that owns the
   * log — and it is the only assertion that would notice React changing which hook fires.
   */
  it('records a render a boundary caught', () => {
    const log = bridgeWatchingLogs()

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
      { onCaughtError: ROOT_ERROR_REPORTING.onCaughtError },
    )

    expect(log.report).toHaveBeenCalledWith({
      level: 'error',
      scope: 'shell.render',
      message: 'Boom: panel exploded',
    })
  })

  /**
   * Called rather than provoked: Testing Library types `onUncaughtError` as `never` and never
   * forwards it, so no rendered tree can reach it. What matters is that it lands on the same
   * reporter — a throw nothing caught is the one React answers by unmounting everything.
   */
  it('records a render nothing caught, under the same scope', () => {
    const log = bridgeWatchingLogs()

    ROOT_ERROR_REPORTING.onUncaughtError?.(new Error('the window is gone'), {
      componentStack: '\n    at Failure',
    })

    expect(log.report).toHaveBeenCalledWith({
      level: 'error',
      scope: 'shell.render',
      message: 'Failure: the window is gone',
    })
  })

  /**
   * The wiring is one argument of `createRoot`, and nothing in the application would notice its
   * removal — the tests above pass with `main.tsx` handing the root no options at all. Read from
   * the source because that module cannot be imported: it has a top-level `await` and mounts.
   */
  it('is what the window actually hands its root', async () => {
    const sources = import.meta.glob<string>('../main.tsx', {
      query: '?raw',
      import: 'default',
    })
    const main = await sources['../main.tsx']?.()

    expect(main).toContain('createRoot(root, ROOT_ERROR_REPORTING)')
  })
})

/**
 * The event is assembled rather than provoked: jsdom exposes no `PromiseRejectionEvent`, and a
 * real `Promise.reject` raises the Node-side warning, not a DOM event on this window.
 */
function rejectWith(reason: unknown): void {
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }))
}

describe('traceDroppedRejections', () => {
  it('writes a rejection nobody caught to the log, and nowhere else', () => {
    const log = bridgeWatchingLogs()
    const stop = traceDroppedRejections()

    rejectWith(new TypeError('disk is full'))
    stop()

    expect(log.trace).toHaveBeenCalledWith({
      scope: 'shell.dropped',
      message: 'TypeError: disk is full',
    })
    // The channel that draws a toast is the other one, and this must never reach it.
    expect(log.report).not.toHaveBeenCalled()
  })

  /**
   * Two things at once, and they hold each other up: a constant subject is the defect this
   * replaced — the log would read as one recurring failure whatever threw — and the repeat is
   * what proves the trace is not deduplicated the way a reported failure is. Dropping the second
   * `RangeError` is what the reader of a log comes for.
   */
  it('names what threw, and says so again when the same thing throws twice', () => {
    const log = bridgeWatchingLogs()
    const stop = traceDroppedRejections()

    rejectWith(new RangeError('out of bounds'))
    rejectWith(new RangeError('out of bounds'))
    rejectWith('a bare string')
    stop()

    expect(log.trace.mock.calls.map(([entry]) => entry.message)).toEqual([
      'RangeError: out of bounds',
      'RangeError: out of bounds',
      'string: a bare string',
    ])
  })

  // An unbounded burst is what this application forbids everywhere else: a promise rejected in
  // an animation frame would otherwise send one message per frame, for as long as it runs.
  it('stops writing once a session has said it enough times', () => {
    const log = bridgeWatchingLogs()
    const stop = traceDroppedRejections()

    for (let i = 0; i < 150; i += 1) rejectWith(new Error(`again ${i}`))
    stop()

    expect(log.trace.mock.calls).toHaveLength(100)
  })

  it('stops writing once the window is done with it', () => {
    const log = bridgeWatchingLogs()

    traceDroppedRejections()()
    rejectWith(new Error('too late'))

    expect(log.trace).not.toHaveBeenCalled()
  })

  /**
   * Same reason as the root options above — nothing else would notice the call going away — plus
   * the ORDER, which is half of what it is worth: `main.tsx` has top-level awaits, so the module
   * splits at the first one. Armed after them, the window starts up with nobody listening, and a
   * presence check alone stays green through exactly that move.
   */
  it('is what the window arms, before anything it awaits', async () => {
    const sources = import.meta.glob<string>('../main.tsx', {
      query: '?raw',
      import: 'default',
    })
    const main = (await sources['../main.tsx']?.()) ?? ''

    expect(main).toContain('traceDroppedRejections()')
    expect(main.indexOf('traceDroppedRejections()')).toBeLessThan(main.indexOf('await '))
  })
})
