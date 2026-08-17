import { describe, expect, it, vi } from 'vitest'
import { IDLE_RESCAN, type RescanState } from '@shared/domain/project'
import type { AsyncCatalog } from './catalog-client'
import type { RescanReport } from './catalog-rescan'
import { createReconciler, type Reconciler } from './reconcile'

const DONE: RescanReport = { moved: 0, missing: 0, returned: 0, complete: true }

type Harness = {
  reconciler: Reconciler
  rescan: ReturnType<typeof vi.fn>
  announced: RescanState[]
  reported: RescanReport[]
  settle: (report?: RescanReport) => Promise<void>
  openProject: (root: string | null) => void
  tick: (ms: number) => void
}

function harness(): Harness {
  let root: string | null = '/projects/one'
  let at = 1_000
  let finish: ((report: RescanReport) => void) | null = null

  const rescan = vi.fn(
    () =>
      new Promise<RescanReport>(resolve => {
        finish = resolve
      }),
  )
  const announced: RescanState[] = []
  const reported: RescanReport[] = []

  const reconciler = createReconciler({
    rootOf: () => root,
    catalogOf: () => ({ rescan }) as unknown as AsyncCatalog,
    announce: state => announced.push(state),
    report: found => reported.push(found),
    warn: () => {},
    clock: () => at,
  })

  return {
    reconciler,
    rescan,
    announced,
    reported,
    settle: async (report = DONE) => {
      finish?.(report)
      finish = null
      // Two turns: the `then` that reports, and the `finally` that publishes idle.
      await Promise.resolve()
      await Promise.resolve()
    },
    openProject: next => {
      root = next
    },
    tick: ms => {
      at += ms
    },
  }
}

describe('deciding when the project is reconciled', () => {
  it('walks the project when one is asked for', () => {
    const { reconciler, rescan, announced } = harness()

    reconciler.request()

    expect(rescan).toHaveBeenCalledWith('/projects/one', expect.anything())
    expect(announced).toEqual([{ running: true, done: 0, total: 0 }])
  })

  // A pass is not queued behind itself: the one running reads the same disk the second would.
  it('does not start a second pass while one is running', () => {
    const { reconciler, rescan } = harness()

    reconciler.request()
    reconciler.request()

    expect(rescan).toHaveBeenCalledTimes(1)
  })

  /**
   * A window regaining focus is not a rare event — clicking into it, ⌘-Tab, a native dialog
   * closing. Without an interval, the very case this exists for (arranging files in the Finder
   * and coming back) would walk the whole project on each of a burst of them.
   */
  it('holds off a second pass over the same project until the interval has passed', async () => {
    const { reconciler, rescan, settle, tick } = harness()

    reconciler.request()
    await settle()
    reconciler.request()

    expect(rescan).toHaveBeenCalledTimes(1)

    tick(6_000)
    reconciler.request()

    expect(rescan).toHaveBeenCalledTimes(2)
  })

  // Another project has never been held against its own catalogue: the interval is about a burst
  // on ONE project, not about how recently the studio did any work at all.
  it('walks another project at once, whatever the interval says', async () => {
    const { reconciler, rescan, settle, openProject } = harness()

    reconciler.request()
    await settle()
    openProject('/projects/two')
    reconciler.request()

    expect(rescan).toHaveBeenCalledTimes(2)
    expect(rescan.mock.calls[1]?.[0]).toBe('/projects/two')
  })

  it('asks nothing with no project open', () => {
    const { reconciler, rescan, openProject } = harness()

    openProject(null)
    reconciler.request()

    expect(rescan).not.toHaveBeenCalled()
  })

  // What a window shows when it is over, and what the journal is handed.
  it('says it is idle again, and reports what the pass changed', async () => {
    const { reconciler, announced, reported, settle } = harness()
    const found: RescanReport = { moved: 3, missing: 1, returned: 0, complete: true }

    reconciler.request()
    await settle(found)

    expect(announced.at(-1)).toEqual(IDLE_RESCAN)
    expect(reported).toEqual([found])
    expect(reconciler.state()).toEqual(IDLE_RESCAN)
  })
})
