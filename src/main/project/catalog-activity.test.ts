import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { ACTIVITY_RETENTION, type ActivityDraft } from '@shared/domain/activity'
import { createCatalog, type Catalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'

const line = (overrides: Partial<ActivityDraft> = {}): ActivityDraft => ({
  at: '2026-08-08T10:00:00.000Z',
  level: 'error',
  topic: 'generation',
  messageKey: 'activity.jobFailed',
  ...overrides,
})

describe('the journal the catalogue keeps', () => {
  let catalog: Catalog

  beforeEach(() => {
    catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
  })

  it('answers nothing before anything has happened', () => {
    expect(catalog.readActivity({})).toEqual([])
  })

  it('writes a line and gives it back with the id the database assigned', () => {
    const [written] = catalog.appendActivity([line()])

    expect(written?.id).toBeGreaterThan(0)
    expect(catalog.readActivity({})).toEqual([written])
  })

  it('carries the key and its parameters across, never a sentence', () => {
    catalog.appendActivity([
      line({ messageKey: 'activity.pushed', params: { count: 3, name: 'x' } }),
    ])

    expect(catalog.readActivity({})[0]).toMatchObject({
      messageKey: 'activity.pushed',
      params: { count: 3, name: 'x' },
    })
  })

  it('keeps the detail and the asset a line is about', () => {
    catalog.appendActivity([line({ detail: 'HTTP 429', assetId: 'asset_1' })])

    expect(catalog.readActivity({})[0]).toMatchObject({ detail: 'HTTP 429', assetId: 'asset_1' })
  })

  it('leaves out what was never written rather than inventing an empty one', () => {
    catalog.appendActivity([line()])

    const [entry] = catalog.readActivity({})
    expect(entry).not.toHaveProperty('params')
    expect(entry).not.toHaveProperty('detail')
    expect(entry).not.toHaveProperty('assetId')
  })

  it('writes a batch in the order it was given, and reads it newest first', () => {
    catalog.appendActivity([
      line({ messageKey: 'activity.imported' }),
      line({ messageKey: 'activity.pushed' }),
    ])

    expect(catalog.readActivity({}).map(entry => entry.messageKey)).toEqual([
      'activity.pushed',
      'activity.imported',
    ])
  })

  it('answers a batch in the order it was handed, so a caller can pair them up', () => {
    const written = catalog.appendActivity([
      line({ messageKey: 'activity.imported' }),
      line({ messageKey: 'activity.pushed' }),
    ])

    expect(written.map(entry => entry.messageKey)).toEqual(['activity.imported', 'activity.pushed'])
  })

  it('writes nothing, and asks nothing of the database, for an empty batch', () => {
    expect(catalog.appendActivity([])).toEqual([])
    expect(catalog.readActivity({})).toEqual([])
  })

  // Narrowing by level or topic is the window's business: it holds what it was given, so a
  // filter costs it no round trip — and the catalogue answers a count, newest first, only.
  it('hands back everything it holds, whatever the lines are about', () => {
    catalog.appendActivity([
      line({ level: 'info', topic: 'import' }),
      line({ level: 'error', topic: 'import' }),
      line({ level: 'error', topic: 'library' }),
    ])

    expect(catalog.readActivity({})).toHaveLength(3)
  })

  it('gives back no more than it was asked for', () => {
    catalog.appendActivity([line(), line(), line()])

    expect(catalog.readActivity({ limit: 2 })).toHaveLength(2)
  })

  // Append-only is the point: a line is a fact about a moment, and the same failure happening
  // twice is two lines rather than one line with a counter.
  it('appends the same failure twice rather than folding it into one', () => {
    catalog.appendActivity([line()])
    catalog.appendActivity([line()])

    expect(catalog.readActivity({})).toHaveLength(2)
  })

  it('bounds what a project keeps, dropping the oldest first', () => {
    // Numbered through the asset: what this measures is which lines survive, and a message key
    // is one of a closed list rather than a counter — `detail` carries `describeFailure` alone.
    const many = Array.from({ length: ACTIVITY_RETENTION + 10 }, (_, index) =>
      line({ assetId: `asset_${index}` }),
    )

    catalog.appendActivity(many)
    const kept = catalog.readActivity({ limit: ACTIVITY_RETENTION + 10 })

    expect(kept).toHaveLength(ACTIVITY_RETENTION)
    expect(kept[0]?.assetId).toBe(`asset_${ACTIVITY_RETENTION + 9}`)
    expect(kept.map(entry => entry.assetId)).not.toContain('asset_0')
  })

  it('keeps trimming across batches, not only within one', () => {
    for (let batch = 0; batch < 3; batch++) {
      catalog.appendActivity(
        Array.from({ length: ACTIVITY_RETENTION }, (_, index) =>
          line({ assetId: `asset_${batch}_${index}` }),
        ),
      )
    }

    expect(catalog.readActivity({ limit: ACTIVITY_RETENTION * 3 })).toHaveLength(ACTIVITY_RETENTION)
  })
})

describe('a journal written by a build that knew more than this one', () => {
  // The columns are free strings in SQLite and closed unions in the domain. A line nobody can
  // read must not take the panel down with it.
  it('reads an unknown level, topic and message key as ordinary ones', () => {
    const driver = openMemoryDatabase()
    onTestFinished(driver.close)
    const catalog = createCatalog(driver)

    driver
      .prepare('INSERT INTO activity (at, level, topic, message_key) VALUES (?, ?, ?, ?)')
      .run('2026-08-08T10:00:00.000Z', 'fatal', 'weather', 'activity.retiredLongAgo')

    expect(catalog.readActivity({})[0]).toMatchObject({
      level: 'info',
      topic: 'library',
      messageKey: 'activity.unknownMessage',
    })
  })

  /**
   * A scope key is composed rather than named, so it is not one of the listed messages — and
   * reading it as unknown would empty the journal of every renderer failure on reopening.
   */
  it('keeps a scope key, which is composed rather than listed', () => {
    const driver = openMemoryDatabase()
    onTestFinished(driver.close)
    const catalog = createCatalog(driver)

    driver
      .prepare('INSERT INTO activity (at, level, topic, message_key) VALUES (?, ?, ?, ?)')
      .run('2026-08-08T10:00:00.000Z', 'error', 'shell', 'activity.scope.scene.model')

    expect(catalog.readActivity({})[0]?.messageKey).toBe('activity.scope.scene.model')
  })

  it('drops a parameter that is neither a string nor a number', () => {
    const driver = openMemoryDatabase()
    onTestFinished(driver.close)
    const catalog = createCatalog(driver)

    driver
      .prepare(
        'INSERT INTO activity (at, level, topic, message_key, params) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        '2026-08-08T10:00:00.000Z',
        'error',
        'import',
        'activity.generatedInto',
        JSON.stringify({ name: 'moss', size: 2, nested: { deep: true } }),
      )

    expect(catalog.readActivity({})[0]?.params).toEqual({ name: 'moss', size: 2 })
  })
})

/**
 * The ids come back from the database and are paired onto the drafts the caller still holds.
 * The pairing has to survive the prune eating the head of the very batch that triggered it.
 */
describe('pairing a batch with the ids it was given', () => {
  let catalog: Catalog

  beforeEach(() => {
    catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
  })

  it('gives each line of a batch the id its own row got', () => {
    const written = catalog.appendActivity([
      line({ messageKey: 'activity.captioned' }),
      line({ messageKey: 'activity.pulled' }),
      line({ messageKey: 'activity.tagsNotSynced' }),
    ])

    for (const entry of written) {
      const stored = catalog.readActivity({}).find(one => one.id === entry.id)
      expect(stored?.messageKey).toBe(entry.messageKey)
    }
  })

  it('keeps pairing right when the journal was already full', () => {
    catalog.appendActivity(
      Array.from({ length: ACTIVITY_RETENTION }, (_, index) => line({ assetId: `old_${index}` })),
    )

    const written = catalog.appendActivity([line({ assetId: 'new_a' }), line({ assetId: 'new_b' })])

    expect(written.map(entry => entry.assetId)).toEqual(['new_a', 'new_b'])
    for (const entry of written) {
      expect(catalog.readActivity({}).find(one => one.id === entry.id)?.assetId).toBe(entry.assetId)
    }
  })

  // The prune runs inside the same transaction, so a batch longer than the retention loses its
  // own oldest lines: what comes back must be the tail that survived, still correctly paired.
  it('answers only the tail of a batch longer than the whole retention', () => {
    const written = catalog.appendActivity(
      Array.from({ length: ACTIVITY_RETENTION + 5 }, (_, index) => line({ assetId: `n_${index}` })),
    )

    expect(written).toHaveLength(ACTIVITY_RETENTION)
    expect(written[0]?.assetId).toBe('n_5')
    expect(written.at(-1)?.assetId).toBe(`n_${ACTIVITY_RETENTION + 4}`)

    for (const entry of [written[0], written.at(-1)]) {
      expect(
        catalog.readActivity({ limit: ACTIVITY_RETENTION }).find(one => one.id === entry?.id)
          ?.assetId,
      ).toBe(entry?.assetId)
    }
  })
})
