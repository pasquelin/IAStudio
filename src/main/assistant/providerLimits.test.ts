import { describe, expect, it, vi } from 'vitest'
import type { ProviderInput } from '@main/provider/schema'
import { INSTRUCTION_FALLBACK, limitsIn, providerLimits } from './providerLimits'

/**
 * `[M]` What `GET /models/model_scenario-llm` answered on 2026-08-30, reduced to the two inputs
 * this door lives inside. `instruction` is bounded by a LENGTH, and the bound is 100 000.
 */
const INPUTS: readonly ProviderInput[] = [
  { name: 'instruction', type: 'string', maxLength: 100_000 },
  {
    name: 'model',
    type: 'string',
    default: 'gemini-3.5-flash-lite',
    allowedValues: ['claude-haiku-4-5', 'gemini-3.5-flash-lite'],
  },
]

describe('what the assistant door reads off its own model', () => {
  // 🛑 The whole point: the figure was declared at 10 000 and called measured. It is 100 000.
  it('takes the instruction bound from the schema rather than from a constant', () => {
    expect(limitsIn(INPUTS)?.instructionMax).toBe(100_000)
  })

  it('takes the language models the schema allows, and the one it defaults to', () => {
    expect(limitsIn(INPUTS)).toMatchObject({
      models: ['claude-haiku-4-5', 'gemini-3.5-flash-lite'],
      defaultModel: 'gemini-3.5-flash-lite',
    })
  })

  // A schema with no `instruction` is not a schema this door can be run against.
  it('answers nothing where the schema names no instruction', () => {
    expect(limitsIn([{ name: 'model', type: 'string' }])).toBeNull()
  })
})

describe('holding that reading for the process', () => {
  /** One network read for the life of the studio, however many turns are taken. */
  it('reads the schema once, whatever it is asked afterwards', async () => {
    const read = vi.fn(() => Promise.resolve(INPUTS))
    const limits = providerLimits(read)

    await Promise.all([limits(), limits()])
    await limits()

    expect(read).toHaveBeenCalledTimes(1)
  })

  /**
   * 🛑 A fallback that ANNOUNCES itself: the door keeps a hard-coded bound when it could not read
   * its own, and `assumed` is what stops the composer showing it as a measurement.
   */
  it('falls back to a declared figure, and says that it is one', async () => {
    const limits = providerLimits(() => Promise.reject(new Error('no key')))

    expect(await limits()).toMatchObject({ instructionMax: INSTRUCTION_FALLBACK, assumed: true })
  })

  /**
   * 🛑 The failure is NOT held: the composer asks this at mount, which on a fresh studio is before
   * any key exists — a memorised refusal would freeze the fallback for the whole session.
   */
  it('asks again after a reading that fell back, and holds the one that worked', async () => {
    const read = vi
      .fn<() => Promise<readonly ProviderInput[] | undefined>>()
      .mockRejectedValueOnce(new Error('no key'))
      .mockResolvedValue(INPUTS)
    const limits = providerLimits(read)

    expect((await limits()).assumed).toBe(true)
    expect((await limits()).instructionMax).toBe(100_000)
    await limits()

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('offers no model of its own when it could not read the list', async () => {
    const limits = providerLimits(() => Promise.resolve(undefined))

    expect(await limits()).toMatchObject({ models: [], defaultModel: null, assumed: true })
  })
})
