import { describe, expect, it, vi } from 'vitest'
import type { MemorySnapshot } from '@shared/domain/aiMemory'
import { STT_MODEL } from '@shared/domain/dictation'
import type { DownloadProgress, LocalModel } from '@shared/domain/localModel'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { HardwareFacts } from './hardwareProbe'
import { createAiManager, type ManagerDeps } from './manager'

const GIBI = 1024 * 1024 * 1024

const FACTS: HardwareFacts = {
  platform: 'linux',
  arch: 'x64',
  cpuCount: 8,
  physicalBytes: 96 * GIBI,
  freeBytes: 34 * GIBI,
  diskFreeBytes: 500 * GIBI,
  gpu: null,
}

const SNAPSHOT: MemorySnapshot = {
  domain: 'unified',
  source: 'probe',
  at: 0,
  physicalBytes: 96 * GIBI,
  appBudgetBytes: 48 * GIBI,
  rendererReservedBytes: GIBI,
  runtimeBytes: {},
  headroomBytes: 2 * GIBI,
  availableBytes: 34 * GIBI,
}

/**
 * A download that hangs until the test lets it go, or until it is aborted.
 *
 * `begun` is what a test waits on before settling it: the manager starts the fetch a tick late,
 * so the lock is in place before anything can clear it.
 */
type Held = {
  install: ManagerDeps['install']
  begun: Promise<void>
  report: (progress: DownloadProgress) => void
  settle: () => void
  fail: (error: Error) => void
  calls: () => number
}

const heldInstall = (): Held => {
  let resolve: (() => void) | undefined
  let reject: ((error: Error) => void) | undefined
  let tell: ((progress: DownloadProgress) => void) | undefined
  let started: () => void = () => {}
  let calls = 0

  return {
    begun: new Promise<void>(ok => {
      started = ok
    }),
    install: (_model, _folder, onProgress, signal) => {
      calls += 1
      tell = onProgress
      started()
      return new Promise<void>((ok, no) => {
        resolve = ok
        reject = no
        signal.addEventListener('abort', () => no(new Error('aborted')))
      })
    },
    report: progress => tell?.(progress),
    settle: () => resolve?.(),
    fail: error => reject?.(error),
    calls: () => calls,
  }
}

const manager = (over: Partial<ManagerDeps> = {}) =>
  createAiManager({
    facts: () => Promise.resolve(FACTS),
    snapshotOf: () => SNAPSHOT,
    settings: () => DEFAULT_SETTINGS,
    writeSettings: () => undefined,
    currentProjectPath: () => null,
    readyClouds: () => [],
    folderFor: () => '/models',
    isInstalled: () => Promise.resolve(false),
    install: () => Promise.resolve(),
    removeFiles: () => Promise.resolve(),
    emit: () => {},
    log: () => {},
    ...over,
  })

const other = (id: string): LocalModel => ({ ...STT_MODEL, id })

const nothing = (_progress: DownloadProgress): void => {}

describe('the AI manager', () => {
  /**
   * The status line and the manager screen fetch the same files into the same folder. Two
   * streams onto one `.part` would fail a digest rather than a download, so the second caller
   * joins the first instead of opening one.
   */
  it('joins two callers asking for the same model onto one download', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })

    const first = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    const second = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    held.settle()
    await Promise.all([first, second])

    expect(held.calls()).toBe(1)
  })

  it('refuses a second model while one is being fetched', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    // Rejected rather than thrown: one channel for one failure, whatever the caller awaits on.
    await expect(ai.installModel(other('another'), nothing)).rejects.toThrow()

    await held.begun
    held.settle()
    await running
  })

  /**
   * A join that only shared the promise left the dictation status line at 0/0 with a cancel
   * button that did nothing, while the manager screen showed the same download moving.
   */
  it('reports to whoever joined, and lets them stop it', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })
    const seen: number[] = []
    const mine = new AbortController()

    const first = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    const second = ai.installModel(STT_MODEL, step => seen.push(step.received), mine.signal)
    await held.begun

    held.report({ received: 7, total: 9 })
    expect(seen).toEqual([7])

    mine.abort()
    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()
  })

  // One lock, so a cancel from the manager screen reaches a download the status line began.
  it('cancels a download whatever asked for it', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    await ai.cancelInstall()

    await expect(running).rejects.toThrow()
  })

  it('lets go of the lock when a download fails', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    held.fail(new Error('network'))
    await expect(running).rejects.toThrow()

    // The second call is what the lock would have refused, had it stayed held.
    const again = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await Promise.resolve()
    held.settle()
    await again

    expect(held.calls()).toBe(2)
  })

  /**
   * A window asked, and what it needs back is the state the studio is in. The dictation session
   * takes the other door — `installModel` rethrows, so it can tell a broken digest from a
   * network that gave up.
   */
  it('answers a window with an overview rather than raising, where the session gets the error', async () => {
    const log = vi.fn()
    const ai = manager({ install: () => Promise.reject(new Error('network')), log })

    await expect(ai.install(STT_MODEL.id)).resolves.toMatchObject({ installing: null })
    await expect(
      ai.installModel(STT_MODEL, nothing, new AbortController().signal),
    ).rejects.toThrow()
    expect(log).toHaveBeenCalled()
  })

  it('says which install is running, so a window that did not ask still follows it', async () => {
    const held = heldInstall()
    const ai = manager({ install: held.install })

    const running = ai.installModel(STT_MODEL, nothing, new AbortController().signal)
    await held.begun
    expect((await ai.overview()).installing?.modelId).toBe(STT_MODEL.id)

    held.settle()
    await running
    expect((await ai.overview()).installing).toBeNull()
  })
})
