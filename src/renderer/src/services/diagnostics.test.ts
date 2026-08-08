import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LOG_MESSAGE } from '@shared/ipc'
import { bridgeWatchingLogs } from './fake-bridge'
import { forgetReportedFailures, reportFailure } from './diagnostics'

beforeEach(forgetReportedFailures)

describe('reportFailure', () => {
  it('sends the failure to the process that owns the log', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))

    expect(bridge.report).toHaveBeenCalledWith({
      level: 'error',
      scope: 'scene.model',
      message: 'mesh-1: unreadable',
    })
  })

  // A thrown string is as ordinary as a thrown Error, and losing it would defeat the point.
  it('describes a rejection that is not an Error', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.export', 'glb', 'disk full')

    expect(bridge.entries()[0]?.message).toBe('glb: disk full')
  })

  /**
   * An engine is rebuilt whenever a panel is detached or a document reopens, and each rebuild
   * asks for every missing asset again: without this, a project whose folder moved refills the
   * log on every detach.
   */
  it('says a given failure once', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))
    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))

    expect(bridge.report).toHaveBeenCalledTimes(1)
  })

  it('still says it for another subject, and for another scope', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))
    reportFailure('scene.model', 'mesh-2', new Error('unreadable'))
    reportFailure('scene.texture', 'mesh-1', new Error('unreadable'))

    expect(bridge.report).toHaveBeenCalledTimes(3)
  })

  // Another project's assets are another story: the same id there is news again.
  it('says it again once what was reported is forgotten', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))
    forgetReportedFailures()
    reportFailure('scene.model', 'mesh-1', new Error('unreadable'))

    expect(bridge.report).toHaveBeenCalledTimes(2)
  })

  it('cuts a message no terminal would show whole before it crosses', () => {
    const bridge = bridgeWatchingLogs()

    reportFailure('scene.model', 'mesh-1', new Error('x'.repeat(10_000)))

    expect(bridge.entries()[0]?.message).toHaveLength(MAX_LOG_MESSAGE)
  })

  // This IS the path failures travel: it must not become one itself.
  it('says nothing, and throws nothing, when there is no bridge', () => {
    vi.stubGlobal('studio', undefined)

    expect(() => reportFailure('scene.model', 'mesh-1', new Error('gone'))).not.toThrow()
  })

  // Awaited on purpose: the rejection is what would surface as an unhandled one a tick later,
  // and a synchronous `not.toThrow()` could never see it.
  it('absorbs a report the boundary itself refuses', async () => {
    const refused = Promise.reject(new Error('no channel'))
    bridgeWatchingLogs({ diagnostics: { report: () => refused } })

    reportFailure('scene.model', 'mesh-1', new Error('gone'))

    await expect(refused.catch(() => 'settled')).resolves.toBe('settled')
  })
})
