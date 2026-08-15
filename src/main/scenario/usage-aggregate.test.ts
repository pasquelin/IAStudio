import { describe, expect, it } from 'vitest'
import { dayOf } from '@shared/domain/usage'
import { aggregate, eventsOf, periodBounds, type AccountUsage } from './usage-aggregate'

const BOUNDS = { from: '2026-07-09', to: '2026-08-08' }

function account(name: string, data: AccountUsage['data']): AccountUsage {
  return { accountId: `acc-${name}`, name, data }
}

function usagePoint(time: string, value: string, cost: number, discount = 0) {
  return { time, value, cost, discount }
}

function modelPoint(time: string, cost: number, jobs: number, apiKeyCost = 0) {
  return { time, cost, discount: 0, jobs, apiKeyCost }
}

describe('periodBounds', () => {
  it('spans today and the days before it', () => {
    const bounds = periodBounds(7, new Date('2026-08-08T15:00:00Z'))

    expect(bounds).toEqual({ from: '2026-08-02', to: '2026-08-08' })
  })

  it('reaches back the API ceiling without leaving the day granularity', () => {
    const bounds = periodBounds(120, new Date('2026-08-08T00:30:00Z'))

    expect(bounds.to).toBe('2026-08-08')
    expect(dayOf(bounds.from)).toBe(bounds.from)
  })
})

describe('aggregate', () => {
  it('adds up what every account spent', () => {
    const report = aggregate(
      [
        account('one', {
          usages: [
            { usageName: 'images-generation', points: [usagePoint('2026-08-01', '3', 30, 5)] },
          ],
        }),
        account('two', {
          usages: [{ usageName: 'models-training', points: [usagePoint('2026-08-01', '1', 12)] }],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.units).toBe(42)
    expect(report.discount).toBe(5)
    expect(report.accounts.map(entry => entry.name)).toEqual(['one', 'two'])
  })

  // These rows restate the other usage names; counted alongside they would double the bill.
  it('leaves the synthesis rows out of the total', () => {
    const report = aggregate(
      [
        account('one', {
          usages: [
            { usageName: 'images-generation', points: [usagePoint('2026-08-01', '2', 20)] },
            { usageName: 'creative-unit-cost', points: [usagePoint('2026-08-01', '2', 20)] },
            { usageName: 'creative-unit-discount', points: [usagePoint('2026-08-01', '0', 0, 7)] },
          ],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.units).toBe(20)
    expect(report.discount).toBe(0)
    expect(report.actions.map(tally => tally.label)).toEqual(['images-generation'])
  })

  it('merges a model run from two accounts into one row', () => {
    const report = aggregate(
      [
        account('one', {
          modelUsages: [{ modelId: 'model_a', points: [modelPoint('2026-08-01', 10, 2, 10)] }],
          entities: { models: [{ id: 'model_a', name: 'Flux Pro' }] },
        }),
        account('two', {
          modelUsages: [{ modelId: 'model_a', points: [modelPoint('2026-08-02', 5, 1)] }],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.models).toEqual([
      { modelId: 'model_a', name: 'Flux Pro', units: 15, jobs: 3, apiKeyUnits: 10 },
    ])
    expect(report.jobs).toBe(3)
  })

  // Two accounts can hold private models with the same name; only the id may merge them.
  it('keeps models apart when only their names match', () => {
    const report = aggregate(
      [
        account('one', {
          modelUsages: [{ modelId: 'model_a', points: [modelPoint('2026-08-01', 10, 1)] }],
          entities: { models: [{ id: 'model_a', name: 'Concept' }] },
        }),
        account('two', {
          modelUsages: [{ modelId: 'model_b', points: [modelPoint('2026-08-01', 4, 1)] }],
          entities: { models: [{ id: 'model_b', name: 'Concept' }] },
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.models).toHaveLength(2)
    expect(report.models.map(model => model.modelId)).toEqual(['model_a', 'model_b'])
  })

  it('falls back to the model id when the API named nothing', () => {
    const report = aggregate(
      [
        account('one', {
          modelUsages: [{ modelId: 'model_x', points: [modelPoint('2026-08-01', 1, 1)] }],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.models[0]?.name).toBe('model_x')
  })

  // A revoked key is the ordinary case: it must not cost the figures the other keys returned.
  it('reports a refused key beside what the others answered', () => {
    const report = aggregate(
      [
        account('working', {
          usages: [{ usageName: 'upscale', points: [usagePoint('2026-08-01', '1', 8)] }],
        }),
        { accountId: 'acc-dead', name: 'revoked', data: null, failure: 'invalid-credentials' },
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.units).toBe(8)
    expect(report.accounts).toHaveLength(1)
    expect(report.silent).toEqual([
      { accountId: 'acc-dead', name: 'revoked', failure: 'invalid-credentials' },
    ])
  })

  it('sorts the daily curve and merges the accounts into each day', () => {
    const report = aggregate(
      [
        account('one', {
          usages: [
            {
              usageName: 'images-generation',
              points: [
                usagePoint('2026-08-02T10:00:00Z', '1', 5),
                usagePoint('2026-08-01T09:00:00Z', '1', 3),
              ],
            },
          ],
        }),
        account('two', {
          usages: [
            {
              usageName: 'images-generation',
              points: [usagePoint('2026-08-01T22:00:00Z', '1', 4)],
            },
          ],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.daily).toEqual([
      { date: '2026-08-01', units: 7 },
      { date: '2026-08-02', units: 5 },
    ])
  })

  it('answers zeros rather than nothing for a period with no activity', () => {
    const report = aggregate([account('one', {})], 7, BOUNDS, null)

    expect(report.units).toBe(0)
    expect(report.daily).toEqual([])
    expect(report.models).toEqual([])
    expect(report.silent).toEqual([])
  })

  it('counts assets by kind without attributing them a cost', () => {
    const report = aggregate(
      [
        account('one', {
          assetUsages: [
            { kind: 'image', points: [{ time: '2026-08-01', count: 4 }] },
            { kind: 'video', points: [{ time: '2026-08-01', count: 0 }] },
          ],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.assets).toEqual([{ label: 'image', count: 4 }])
  })
})

describe('aggregate, on what the API leaves out', () => {
  // Free actions report no cost field at all rather than a zero.
  it('treats a point with no cost as costing nothing', () => {
    const report = aggregate(
      [
        account('one', {
          usages: [{ usageName: 'patch', points: [{ time: '2026-08-01', value: '2' }] }],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.units).toBe(0)
    expect(report.actions).toEqual([{ label: 'patch', count: 2, units: 0 }])
  })

  it('counts an unparseable tally as nothing rather than as NaN', () => {
    const report = aggregate(
      [
        account('one', {
          usages: [{ usageName: 'upscale', points: [usagePoint('2026-08-01', 'n/a', 4)] }],
        }),
      ],
      31,
      BOUNDS,
      null,
    )

    expect(report.actions).toEqual([{ label: 'upscale', count: 0, units: 4 }])
  })

  it('falls back to an unexplained failure when a key gave no reason', () => {
    const report = aggregate([{ accountId: 'acc-1', name: 'mute', data: null }], 31, BOUNDS, null)

    expect(report.silent).toEqual([{ accountId: 'acc-1', name: 'mute', failure: 'unexpected' }])
  })

  it('carries the price through to the report untouched', () => {
    const price = { perUnit: 0.01, currency: 'EUR' }
    const report = aggregate([account('one', {})], 31, BOUNDS, price)

    expect(report.price).toEqual(price)
  })
})

describe('eventsOf', () => {
  it('keeps the job id when the event carries one, and the raw model id when unnamed', () => {
    const events = eventsOf([
      account('one', {
        activity: [
          {
            action: 'txt2img',
            time: '2026-08-01T10:00:00Z',
            data: { modelId: 'model_unnamed', jobId: 'job_1' },
            creativeUnitsCost: 2,
          },
        ],
      }),
    ])

    expect(events[0]).toMatchObject({ jobId: 'job_1', modelName: 'model_unnamed', units: 2 })
  })

  it('flattens the log across accounts, newest first, naming the model', () => {
    const events = eventsOf([
      account('one', {
        activity: [
          {
            action: 'txt2img',
            time: '2026-08-01T10:00:00Z',
            data: { modelId: 'model_a' },
            creativeUnitsCost: 4,
          },
        ],
        entities: { models: [{ id: 'model_a', name: 'Flux Pro' }] },
      }),
      account('two', {
        activity: [{ action: 'delete-asset', time: '2026-08-02T10:00:00Z', data: {} }],
      }),
    ])

    expect(events.map(event => event.action)).toEqual(['delete-asset', 'txt2img'])
    expect(events[1]?.modelName).toBe('Flux Pro')
    // Free actions report zero rather than nothing: the column stays a number.
    expect(events[0]?.units).toBe(0)
  })
})
