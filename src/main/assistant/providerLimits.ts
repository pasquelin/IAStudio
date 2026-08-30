import type { ProviderInput } from '@main/provider/schema'
import { log } from '@main/log'

/**
 * 🛑 A DECLARED FALLBACK, not a measurement: what this door holds itself to when it could not read
 * its own schema, which answers ten times this. It belongs to THIS door — shared, it was once
 * applied to seven chat clouds that take dozens of times more.
 */
export const INSTRUCTION_FALLBACK = 10_000

/** What `GET /models/model_scenario-llm` says the door accepts, or the fallback said as one. */
export type ProviderLimits = {
  /** CHARACTERS the `instruction` field takes — that field is bounded by length, not by tokens. */
  instructionMax: number
  /** The language models the schema allows. Empty when nothing was read. */
  models: readonly string[]
  /** The one the schema itself defaults to, and what an unlisted choice falls back to. */
  defaultModel: string | null
  /** True when everything above is the declared fallback rather than the schema's own word. */
  assumed: boolean
}

const FALLBACK: ProviderLimits = {
  instructionMax: INSTRUCTION_FALLBACK,
  models: [],
  defaultModel: null,
  assumed: true,
}

const inputNamed = (
  inputs: readonly ProviderInput[] | undefined,
  name: string,
): ProviderInput | undefined => inputs?.find(one => one.name === name)

/**
 * The bounds the assistant lives inside, read off the model's own inputs — invariant 5. `null`
 * when the schema names no `instruction`, the one field this door cannot do without.
 */
export function limitsIn(inputs: readonly ProviderInput[] | undefined): ProviderLimits | null {
  const instruction = inputNamed(inputs, 'instruction')
  if (instruction?.maxLength === undefined) return null

  const model = inputNamed(inputs, 'model')
  return {
    instructionMax: instruction.maxLength,
    models: (model?.allowedValues ?? []).map(String),
    defaultModel: typeof model?.default === 'string' ? model.default : null,
    assumed: false,
  }
}

/**
 * The same, read once and held for the process — the READING, never the failure.
 *
 * 🛑 A memorised failure would freeze the fallback for the session: the composer asks this at
 * MOUNT, which on a fresh studio is before any key exists. Only a fallback is asked again, and a
 * studio with no key answers it without a request at all.
 */
export function providerLimits(
  read: () => Promise<readonly ProviderInput[] | undefined>,
): () => Promise<ProviderLimits> {
  let asked: Promise<ProviderLimits> | null = null

  const attempt = async (): Promise<ProviderLimits> => {
    try {
      const found = limitsIn(await read())
      if (found === null) {
        log.warn(
          'assistant',
          'the assistant model names no instruction bound: keeping the fallback',
        )
        return FALLBACK
      }
      return found
    } catch (error) {
      log.warn('assistant', `reading the assistant model's schema failed: ${String(error)}`)
      return FALLBACK
    }
  }

  return async () => {
    const reading = (asked ??= attempt())
    const found = await reading
    if (found.assumed && asked === reading) asked = null

    return found
  }
}
