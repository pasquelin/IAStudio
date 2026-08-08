import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { costEstimatorOf, type CostEstimator } from './cost'

const refusedWith = (status: number, body: object): unknown =>
  APIError.generate(status, body, undefined, new Headers())

const estimator = (answer: () => Promise<unknown>): CostEstimator => costEstimatorOf(vi.fn(answer))

describe('cost estimate', () => {
  /**
   * The one call in the studio where a 4xx is the success path: a dry run answers 402 and puts
   * the figure in the body. Read as an ordinary failure, the button would say nothing.
   */
  it('reads the estimate off the 402 the API answers with', async () => {
    const estimate = estimator(() =>
      Promise.reject(refusedWith(402, { message: 'Dry run completed', estimatedCost: 12 })),
    )

    await expect(estimate('model_flux', { prompt: 'a rock' })).resolves.toEqual({
      creativeUnits: 12,
    })
  })

  it('asks whatever it was handed, with the body as it stands', async () => {
    const run = vi.fn(() => Promise.reject(refusedWith(402, { estimatedCost: 3 })))
    await costEstimatorOf(run)('model_flux', { prompt: 'a rock' })

    expect(run).toHaveBeenCalledWith('model_flux', { prompt: 'a rock' })
  })

  // A price is a courtesy: no figure means a button with no badge, never a button that refuses.
  it('answers with no figure rather than a failure when the API prices nothing', async () => {
    await expect(
      estimator(() => Promise.resolve({ job: {} }))('model_flux', {}),
    ).resolves.toBeNull()
  })

  /**
   * A 402 is the answer; anything else is a failure, and swallowing it would leave an outage
   * with no line in the log and no entry in the journal — the button says nothing either way.
   */
  it('lets a refusal that is not a dry run travel', async () => {
    const estimate = estimator(() => Promise.reject(refusedWith(400, { message: 'bad body' })))

    await expect(estimate('model_flux', {})).rejects.toThrow()
  })

  it('lets a dead network travel too', async () => {
    const estimate = estimator(() => Promise.reject(new Error('offline')))

    await expect(estimate('model_flux', {})).rejects.toThrow('offline')
  })

  it('answers with no figure on a 402 that carries no number', async () => {
    const estimate = estimator(() => Promise.reject(refusedWith(402, { estimatedCost: 'twelve' })))

    await expect(estimate('model_flux', {})).resolves.toBeNull()
  })

  // A 402 with nothing parsed behind it — a gateway's own page, an empty body.
  it('answers with no figure on a 402 that carries no body at all', async () => {
    const estimate = estimator(() =>
      Promise.reject(APIError.generate(402, undefined, 'Payment Required', new Headers())),
    )

    await expect(estimate('model_flux', {})).resolves.toBeNull()
  })

  // A number that is not one: it would reach the button as « ~Infinity CU » or « ~NaN CU ».
  it('answers with no figure on a number that cannot be drawn', async () => {
    const estimate = estimator(() =>
      Promise.reject(refusedWith(402, { estimatedCost: Number.POSITIVE_INFINITY })),
    )

    await expect(estimate('model_flux', {})).resolves.toBeNull()
  })
})
