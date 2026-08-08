import { beforeEach, describe, expect, it } from 'vitest'
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
      line({ messageKey: 'activity.first' }),
      line({ messageKey: 'activity.second' }),
    ])

    expect(catalog.readActivity({}).map(entry => entry.messageKey)).toEqual([
      'activity.second',
      'activity.first',
    ])
  })

  it('answers a batch in the order it was handed, so a caller can pair them up', () => {
    const written = catalog.appendActivity([
      line({ messageKey: 'activity.first' }),
      line({ messageKey: 'activity.second' }),
    ])

    expect(written.map(entry => entry.messageKey)).toEqual(['activity.first', 'activity.second'])
  })

  it('writes nothing, and asks nothing of the database, for an empty batch', () => {
    expect(catalog.appendActivity([])).toEqual([])
    expect(catalog.readActivity({})).toEqual([])
  })

  it('filters by level, and by topic, and by both at once', () => {
    catalog.appendActivity([
      line({ level: 'info', topic: 'import' }),
      line({ level: 'error', topic: 'import' }),
      line({ level: 'error', topic: 'library' }),
    ])

    expect(catalog.readActivity({ levels: ['error'] })).toHaveLength(2)
    expect(catalog.readActivity({ topics: ['import'] })).toHaveLength(2)
    expect(catalog.readActivity({ levels: ['error'], topics: ['import'] })).toHaveLength(1)
  })

  // An empty list is "no filter", not "nothing": a panel whose filters were just cleared would
  // otherwise show an empty journal and read as broken.
  it('reads an empty filter as no filter', () => {
    catalog.appendActivity([line()])

    expect(catalog.readActivity({ levels: [], topics: [] })).toHaveLength(1)
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
    const many = Array.from({ length: ACTIVITY_RETENTION + 10 }, (_, index) =>
      line({ messageKey: `activity.n${index}` }),
    )

    catalog.appendActivity(many)
    const kept = catalog.readActivity({ limit: ACTIVITY_RETENTION + 10 })

    expect(kept).toHaveLength(ACTIVITY_RETENTION)
    expect(kept[0]?.messageKey).toBe(`activity.n${ACTIVITY_RETENTION + 9}`)
    expect(kept.map(entry => entry.messageKey)).not.toContain('activity.n0')
  })

  it('keeps trimming across batches, not only within one', () => {
    for (let batch = 0; batch < 3; batch++) {
      catalog.appendActivity(
        Array.from({ length: ACTIVITY_RETENTION }, (_, index) =>
          line({ messageKey: `activity.b${batch}n${index}` }),
        ),
      )
    }

    expect(catalog.readActivity({ limit: ACTIVITY_RETENTION * 3 })).toHaveLength(ACTIVITY_RETENTION)
  })
})

describe('a journal written by a build that knew more than this one', () => {
  // The columns are free strings in SQLite and closed unions in the domain. A line nobody can
  // read must not take the panel down with it.
  it('reads an unknown level and topic as ordinary ones', () => {
    const driver = openMemoryDatabase()
    const catalog = createCatalog(driver)

    driver
      .prepare('INSERT INTO activity (at, level, topic, message_key) VALUES (?, ?, ?, ?)')
      .run('2026-08-08T10:00:00.000Z', 'fatal', 'weather', 'activity.unknown')

    expect(catalog.readActivity({})[0]).toMatchObject({ level: 'info', topic: 'document' })
  })

  it('drops a parameter that is neither a string nor a number', () => {
    const driver = openMemoryDatabase()
    const catalog = createCatalog(driver)

    driver
      .prepare(
        'INSERT INTO activity (at, level, topic, message_key, params) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        '2026-08-08T10:00:00.000Z',
        'error',
        'import',
        'activity.mixed',
        JSON.stringify({ name: 'moss', size: 2, nested: { deep: true } }),
      )

    expect(catalog.readActivity({})[0]?.params).toEqual({ name: 'moss', size: 2 })
  })
})
