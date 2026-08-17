import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_WINDOW, type ActivityEntry } from '@shared/domain/activity'
import { installFakeBridge } from '@/services/fakeBridge'
import { failureCount, useActivity, visibleActivity } from './activity'

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 1,
  at: '2026-08-08T10:00:00.000Z',
  level: 'error',
  topic: 'library',
  messageKey: 'activity.pushFailed',
  ...overrides,
})

const state = () => useActivity.getState()

describe('the journal, as the window holds it', () => {
  beforeEach(() => {
    useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
  })

  it('reads the journal back and follows what is written next', async () => {
    const onEntries = vi.fn<(callback: (entries: readonly ActivityEntry[]) => void) => () => void>(
      () => () => {},
    )
    installFakeBridge({
      activity: { read: () => Promise.resolve([entry()]), onEntries },
    })

    await state().connect()

    expect(state().entries).toEqual([entry()])
    expect(onEntries).toHaveBeenCalled()
  })

  // The batch that just arrived IS the newest; re-reading would throw away the list the panel
  // is scrolled through.
  it('puts a new batch on top, newest first, without asking again', () => {
    useActivity.setState({ entries: [entry({ id: 1 })] })

    state().append([entry({ id: 2 }), entry({ id: 3 })])

    expect(state().entries.map(one => one.id)).toEqual([3, 2, 1])
  })

  it('keeps no more than a window shows', () => {
    state().append(Array.from({ length: ACTIVITY_WINDOW + 50 }, (_, id) => entry({ id })))

    expect(state().entries).toHaveLength(ACTIVITY_WINDOW)
  })

  it('survives having no bridge at all, as a plain browser has none', async () => {
    vi.unstubAllGlobals()

    const stop = await state().connect()

    expect(state().entries).toEqual([])
    expect(stop).toBeTypeOf('function')
  })
})

describe('what the panel shows', () => {
  beforeEach(() => {
    useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
  })

  it('shows everything until a filter says otherwise', () => {
    useActivity.setState({ entries: [entry({ level: 'info' }), entry({ level: 'error' })] })

    expect(visibleActivity(state().entries, state())).toHaveLength(2)
  })

  it('filters what it already holds, so changing a filter costs no round trip', () => {
    useActivity.setState({
      entries: [entry({ id: 1, level: 'info' }), entry({ id: 2, level: 'error' })],
    })

    state().setFilters({ levels: ['error'] })

    expect(visibleActivity(state().entries, state()).map(one => one.id)).toEqual([2])
  })

  it('filters by topic as well, and by both at once', () => {
    useActivity.setState({
      entries: [
        entry({ id: 1, level: 'error', topic: 'import' }),
        entry({ id: 2, level: 'error', topic: 'library' }),
        entry({ id: 3, level: 'info', topic: 'import' }),
      ],
    })

    state().setFilters({ topics: ['import'] })
    expect(visibleActivity(state().entries, state()).map(one => one.id)).toEqual([1, 3])

    state().setFilters({ levels: ['error'] })
    expect(visibleActivity(state().entries, state()).map(one => one.id)).toEqual([1])
  })

  it('counts the failures, which is what the status line says', () => {
    useActivity.setState({
      entries: [entry({ level: 'error' }), entry({ level: 'warn' }), entry({ level: 'error' })],
    })

    expect(failureCount(state())).toBe(2)
  })
})

describe('what gets shown as a toast', () => {
  beforeEach(() => {
    useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
  })

  it('raises a failure, and stays quiet about the rest', () => {
    state().append([entry({ id: 1, level: 'error' }), entry({ id: 2, level: 'info' })])

    expect(state().unread.map(one => one.id)).toEqual([1])
  })

  /**
   * The axis is the MESSAGE, not the level, and this is what the difference buys: switching
   * accounts changes which remote library the open project reads and nobody has the journal open
   * at that moment, while a caption batch refused inside a loop over every batch would leave the
   * user closing toasts one by one — toasts do not expire.
   */
  it('raises a line that asks for attention, and leaves an ordinary warning alone', () => {
    state().append([
      entry({ id: 1, level: 'warn', messageKey: 'activity.projectAccountSwitched' }),
      entry({ id: 2, level: 'warn', messageKey: 'activity.captionFailed' }),
    ])

    expect(state().unread.map(one => one.id)).toEqual([1])
  })

  // A key that expired mid-push is forty lines and one problem; past a few, the toasts would
  // cover the work they report on.
  it('stops stacking a burst of the same trouble', () => {
    state().append(Array.from({ length: 40 }, (_, id) => entry({ id, level: 'error' })))

    expect(state().unread.length).toBeLessThanOrEqual(3)
  })

  /**
   * The burst a switch itself provokes: every cache is purged, so refetching under a key the API
   * refuses answers a run of failures. Evicting by arrival alone would push out the one sentence
   * saying the key had changed — the line the user cannot go and read later.
   */
  it('drops failures before the line that asked for attention', () => {
    state().append([entry({ id: 1, level: 'warn', messageKey: 'activity.projectAccountSwitched' })])
    state().append(Array.from({ length: 6 }, (_, index) => entry({ id: index + 2 })))

    expect(state().unread.map(one => one.id)).toContain(1)
  })

  it('raises a failure the current filter would have hidden', () => {
    state().setFilters({ levels: ['info'] })

    state().append([entry({ id: 7, level: 'error' })])

    expect(state().unread.map(one => one.id)).toEqual([7])
    expect(visibleActivity(state().entries, state())).toEqual([])
  })

  it('lets one be dismissed, and all of them at once', () => {
    state().append([entry({ id: 1 }), entry({ id: 2 })])

    state().dismiss(1)
    expect(state().unread.map(one => one.id)).toEqual([2])

    state().dismissAll()
    expect(state().unread).toEqual([])
  })

  // Dismissing is not forgetting: the line stays in the journal, which is where one goes to
  // read what went wrong after the toast is gone.
  it('leaves the journal alone when a toast is dismissed', () => {
    state().append([entry({ id: 1 })])

    state().dismissAll()

    expect(state().entries).toHaveLength(1)
  })
})

/**
 * The journal belongs to the project's own catalogue. Everything it holds is another project's
 * account of itself, and the toasts never expire on their own.
 */
describe('changing project', () => {
  beforeEach(() => {
    useActivity.setState({ entries: [], levels: [], topics: [], unread: [] })
  })

  it('reads the new project journal rather than keeping the last one', async () => {
    useActivity.setState({ entries: [entry({ id: 1, messageKey: 'activity.imported' })] })
    installFakeBridge({ activity: { read: () => Promise.resolve([entry({ id: 2 })]) } })

    await state().reload()

    expect(state().entries.map(one => one.messageKey)).toEqual(['activity.pushFailed'])
  })

  // A toast raised by the project being left would hang over the one being opened, naming an
  // asset that is no longer anywhere.
  it('takes down a toast the project it belonged to is gone', () => {
    state().append([entry({ id: 1, level: 'error' })])
    expect(state().unread).toHaveLength(1)

    state().dismissAll()

    expect(state().unread).toEqual([])
  })
})
