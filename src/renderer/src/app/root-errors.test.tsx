import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { forgetReportedFailures } from '@/services/diagnostics'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { ROOT_ERROR_REPORTING } from './root-errors'

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
