import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bridgeWatchingLogs } from '@/services/fakeBridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { closeTab } from './closeTab'

const closeDocument = vi.fn((_id: string) => Promise.resolve(true))
vi.mock('../../../documentIo', () => ({ closeDocument: (id: string) => closeDocument(id) }))

beforeEach(() => {
  vi.clearAllMocks()
  forgetReportedFailures()
})

/**
 * The `.catch` is the whole reason this module exists: the cross and the menu row both close a
 * document from a gesture that has no surface of its own left by the time the disk refuses.
 */
describe('closing a tab', () => {
  it('closes the document it names', () => {
    bridgeWatchingLogs()

    closeTab('doc-1')
    expect(closeDocument).toHaveBeenCalledWith('doc-1')
  })

  it('sends a refusal from the disk to the journal', async () => {
    const bridge = bridgeWatchingLogs()
    closeDocument.mockRejectedValueOnce(new Error('read-only volume'))

    closeTab('doc-1')
    // The rejection is handled a microtask later; nothing awaits it on the caller's side.
    await vi.waitFor(() => expect(bridge.report).toHaveBeenCalled())

    expect(bridge.entries()[0]).toMatchObject({
      level: 'error',
      scope: 'document.close',
      message: expect.stringContaining('read-only volume'),
    })
  })

  // It hangs off a click. A throw here would reach no boundary that could show it.
  it('throws nothing at the caller', () => {
    bridgeWatchingLogs()
    closeDocument.mockRejectedValueOnce(new Error('gone'))

    expect(() => closeTab('doc-1')).not.toThrow()
  })
})
