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

describe('the diagnostics report handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHandlers()
    registerDiagnosticsHandlers()
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
