import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS, MAX_LOG_MESSAGE } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { log } from '@main/log'
import { registerDiagnosticsHandlers } from './handlers'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

// The real one writes nothing under test — `log.ts` goes quiet on NODE_ENV — so what it was
// asked to write is what there is to assert on.
vi.mock('@main/log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const entry = { level: 'error', scope: 'scene.model', message: 'mesh-1: unreadable' }

const journal = { record: vi.fn(), read: vi.fn(), flush: vi.fn(), dispose: vi.fn() }

describe('the diagnostics report handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHandlers()
    registerDiagnosticsHandlers(() => journal)
  })

  it('writes the renderer failure at the level it was reported', async () => {
    await invoke(CHANNELS.diagnosticsReport, entry)

    expect(log.error).toHaveBeenCalledWith('renderer/scene.model', 'mesh-1: unreadable')
  })

  it('writes a warning as a warning', async () => {
    await invoke(CHANNELS.diagnosticsReport, { ...entry, level: 'warn' })

    expect(log.warn).toHaveBeenCalled()
    expect(log.error).not.toHaveBeenCalled()
  })

  // The prefix is added here so a line can never claim to come from the main process itself.
  it('refuses a scope the studio does not declare', () => {
    const forged = { ...entry, scope: 'main/scenario' }

    expect(() => invoke(CHANNELS.diagnosticsReport, forged)).toThrow()
  })

  // Asserted on what was NOT written: `log` has no `debug`, so a missing guard would throw too,
  // and a test that only expected a throw would pass for the wrong reason.
  it('refuses a level the log has no writer for', () => {
    expect(() => invoke(CHANNELS.diagnosticsReport, { ...entry, level: 'debug' })).toThrow()
    expect(log.error).not.toHaveBeenCalled()
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.info).not.toHaveBeenCalled()
  })

  // The sandboxed side is the one sending: a renderer looping on a failure must not fill the
  // terminal, and a truncated line still says what failed.
  it('cuts a message no terminal would show whole', async () => {
    await invoke(CHANNELS.diagnosticsReport, { ...entry, message: 'x'.repeat(10_000) })

    const written = vi.mocked(log.error).mock.calls[0]?.[1] ?? ''
    expect(written).toHaveLength(MAX_LOG_MESSAGE)
  })

  it('refuses an entry that is not one', () => {
    expect(() => invoke(CHANNELS.diagnosticsReport, { level: 'error' })).toThrow()
  })
})

/**
 * This channel is the funnel every renderer failure already went through — a 3D model that
 * would not load, an export that broke. Feeding the journal here rather than from each caller
 * is what covers all eight scopes at once.
 */
describe('what a renderer failure leaves in the journal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHandlers()
    registerDiagnosticsHandlers(() => journal)
  })

  it('records the failure under the part of the studio it came from', async () => {
    await invoke(CHANNELS.diagnosticsReport, entry)

    expect(journal.record).toHaveBeenCalledWith({
      level: 'error',
      topic: 'document',
      messageKey: 'activity.scope.scene.model',
      detail: 'mesh-1: unreadable',
    })
  })

  it('files what the library refused under the library', async () => {
    await invoke(CHANNELS.diagnosticsReport, { ...entry, scope: 'assets.reveal' })

    expect(journal.record).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'library', messageKey: 'activity.scope.assets.reveal' }),
    )
  })

  it('keeps the level it was reported at, so a warning does not read as a failure', async () => {
    await invoke(CHANNELS.diagnosticsReport, { ...entry, level: 'warn' })

    expect(journal.record).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn' }))
  })

  // A key and its parameters, never a sentence: the journal outlives the language it was
  // written in, and the detail is the only free text a line carries.
  it('names a key rather than storing the sentence the renderer sent', async () => {
    await invoke(CHANNELS.diagnosticsReport, entry)

    const recorded = journal.record.mock.calls[0]?.[0]
    expect(recorded.messageKey).toMatch(/^activity\./)
  })

  it('records nothing when the entry was refused', () => {
    expect(() => invoke(CHANNELS.diagnosticsReport, { level: 'error' })).toThrow()
    expect(journal.record).not.toHaveBeenCalled()
  })
})

describe('the diagnostics trace handler', () => {
  const dropped = { scope: 'shell.dropped', message: 'TypeError: disk is full' }

  beforeEach(() => {
    vi.clearAllMocks()
    resetHandlers()
    registerDiagnosticsHandlers(() => journal)
  })

  it('writes the line to the log the main process owns', async () => {
    await invoke(CHANNELS.diagnosticsTrace, dropped)

    expect(log.error).toHaveBeenCalledWith('renderer/shell.dropped', 'TypeError: disk is full')
  })

  /**
   * The whole point of the second channel. A journal row becomes a toast on the way, and a
   * rejected promise names no gesture and no document: there is nothing the reader could do
   * about it, and being interrupted over it is what made the first attempt at this a defect.
   */
  it('leaves the journal alone, so nothing reaches the screen', async () => {
    await invoke(CHANNELS.diagnosticsTrace, dropped)

    expect(journal.record).not.toHaveBeenCalled()
  })

  // Routing a scope that has a topic through here would file a failure the reader is meant to
  // see, unseen. That the two lists share no name is the compiler's to hold, not this file's:
  // comparing a `LogScope` to a `TraceScope` does not typecheck while they stay disjoint.
  it('refuses a scope that belongs to the journal', () => {
    expect(() => invoke(CHANNELS.diagnosticsTrace, { ...dropped, scope: 'scene.model' })).toThrow()
    expect(log.error).not.toHaveBeenCalled()
  })
})
