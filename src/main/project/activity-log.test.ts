import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityEntry } from '@shared/domain/activity'
import { ACTIVITY_FLUSH_MS, createActivityLog, type ActivityLog } from './activity-log'
import { memoryCatalog } from './catalog-fixtures'
import type { AsyncCatalog } from './catalog-client'

type Broadcast = (entries: readonly ActivityEntry[]) => void

const spy = () => vi.fn<Broadcast>()

/** Lets whatever was started reach its first await. */
const settled = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

describe('the studio recording what it did', () => {
  let catalog: AsyncCatalog
  let broadcast: ReturnType<typeof spy>
  let journal: ActivityLog

  beforeEach(() => {
    catalog = memoryCatalog()
    broadcast = spy()
    journal = createActivityLog({
      catalog: () => catalog,
      broadcast,
      now: () => '2026-08-08T10:00:00.000Z',
    })
  })

  it('keeps what it was told, and stamps the time so no caller has to', async () => {
    journal.record({ level: 'error', topic: 'generation', messageKey: 'activity.jobFailed' })
    await journal.flush()

    expect(await journal.read({})).toEqual([
      expect.objectContaining({
        at: '2026-08-08T10:00:00.000Z',
        level: 'error',
        topic: 'generation',
        messageKey: 'activity.jobFailed',
      }),
    ])
  })

  // A push of two hundred assets records two hundred lines. One message each would spend the
  // boundary on bookkeeping — the same reason the ingest bar coalesces its progress.
  it('sends one message for a burst rather than one per line', async () => {
    for (let index = 0; index < 200; index++) {
      journal.record({ level: 'info', topic: 'library', messageKey: `activity.n${index}` })
    }
    await journal.flush()

    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast.mock.calls[0]?.[0]).toHaveLength(200)
  })

  it('hands the windows the ids the database gave, so two lines are never confused', async () => {
    journal.record({ level: 'info', topic: 'import', messageKey: 'activity.a' })
    journal.record({ level: 'info', topic: 'import', messageKey: 'activity.b' })
    await journal.flush()

    const sent: readonly ActivityEntry[] = broadcast.mock.calls[0]?.[0] ?? []
    expect(new Set(sent.map(entry => entry.id)).size).toBe(2)
    expect(sent.every(entry => entry.id > 0)).toBe(true)
  })

  it('says nothing at all when nothing was recorded', async () => {
    await journal.flush()

    expect(broadcast).not.toHaveBeenCalled()
  })

  it('records the same failure twice rather than folding it into one', async () => {
    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.pushFailed' })
    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.pushFailed' })
    await journal.flush()

    expect(await journal.read({})).toHaveLength(2)
  })

  // Narrowing is the window's business — it holds what it was given. This one only bounds.
  it('asks the catalogue for no more lines than it was told to', async () => {
    journal.record({ level: 'info', topic: 'import', messageKey: 'activity.imported' })
    journal.record({ level: 'error', topic: 'import', messageKey: 'activity.importFailed' })
    await journal.flush()

    expect(await journal.read({ limit: 1 })).toHaveLength(1)
  })

  it('writes on its own, without anyone asking it to', async () => {
    vi.useFakeTimers()
    const timed = createActivityLog({
      catalog: () => catalog,
      broadcast,
      now: () => '2026-08-08T10:00:00.000Z',
      // The real cadence: nothing may depend on a test-only one.
    })

    timed.record({ level: 'warn', topic: 'document', messageKey: 'activity.saveFailed' })
    expect(broadcast).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(ACTIVITY_FLUSH_MS)
    vi.useRealTimers()

    expect(broadcast).toHaveBeenCalledTimes(1)
  })
})

describe('recording with no project open', () => {
  it('still tells the windows, since a failure the user cannot see is the bug being fixed', async () => {
    const broadcast = spy()
    const journal = createActivityLog({
      catalog: () => null,
      broadcast,
      now: () => '2026-08-08T10:00:00.000Z',
    })

    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.noProject' })
    await journal.flush()

    expect(broadcast).toHaveBeenCalledTimes(1)
  })

  // SQLite counts up from 1, so counting down from 0 can never collide with a stored line —
  // and the windows need distinct ids to tell two lines apart.
  it('gives the lines it could not keep ids no stored line will ever take', async () => {
    const broadcast = spy()
    const journal = createActivityLog({
      catalog: () => null,
      broadcast,
      now: () => '2026-08-08T10:00:00.000Z',
    })

    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.a' })
    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.b' })
    await journal.flush()

    const sent: readonly ActivityEntry[] = broadcast.mock.calls[0]?.[0] ?? []
    expect(sent.every(entry => entry.id <= 0)).toBe(true)
    expect(new Set(sent.map(entry => entry.id)).size).toBe(2)
  })

  it('answers an empty journal rather than failing to read one', async () => {
    const journal = createActivityLog({
      catalog: () => null,
      broadcast: spy(),
      now: () => '2026-08-08T10:00:00.000Z',
    })

    expect(await journal.read({})).toEqual([])
  })
})

describe('when the journal itself cannot be written', () => {
  // Saying so in the journal would loop: it is the journal that is broken.
  it('does not throw at the caller that was reporting a failure', async () => {
    const journal = createActivityLog({
      catalog: () => ({
        ...memoryCatalog(),
        appendActivity: () => Promise.reject(new Error('disk is full')),
      }),
      broadcast: spy(),
      now: () => '2026-08-08T10:00:00.000Z',
    })

    journal.record({ level: 'error', topic: 'import', messageKey: 'activity.importFailed' })

    await expect(journal.flush()).resolves.toBeUndefined()
  })
})

describe('a journal that has been disposed', () => {
  it('takes nothing more, so a closing project cannot be written to', async () => {
    const broadcast = spy()
    const journal = createActivityLog({
      catalog: () => memoryCatalog(),
      broadcast,
      now: () => '2026-08-08T10:00:00.000Z',
    })

    journal.dispose()
    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.late' })
    await journal.flush()

    expect(broadcast).not.toHaveBeenCalled()
  })
})

/**
 * `flush` is what the shutdown path and a project change both call before the catalogue stops
 * answering. Waiting only on what is queued would leave a batch already on its way to be
 * rejected by the close that follows.
 */
describe('flushing while a write is already on its way', () => {
  it('waits for the batch in flight, not only for what is still queued', async () => {
    let release: (() => void) | undefined
    const written: string[] = []
    const held = memoryCatalog()

    const journal = createActivityLog({
      catalog: () => ({
        ...held,
        appendActivity: async entries => {
          if (!release) await new Promise<void>(resolve => (release = resolve))
          written.push(...entries.map(entry => entry.messageKey))
          return held.appendActivity(entries)
        },
      }),
      broadcast: spy(),
      now: () => '2026-08-08T10:00:00.000Z',
    })

    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.first' })
    const inFlight = journal.flush()
    await settled()

    // Lands behind a write that has not come back yet.
    journal.record({ level: 'error', topic: 'library', messageKey: 'activity.second' })
    const settling = journal.flush()
    await settled()

    release?.()
    await Promise.all([inFlight, settling])

    expect(written).toEqual(['activity.first', 'activity.second'])
  })
})
