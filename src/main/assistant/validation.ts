import { z } from 'zod'
import { HISTORY_MAX, INSTRUCTION_MAX, type AssistantThought } from '@shared/domain/assistant'

/**
 * What a window may ask the assistant to think about.
 *
 * Bounded on both counts, and the bounds are the model's own: an instruction over ten thousand
 * characters is answered with a 400, and only ten blocks of history are carried. Cutting here
 * rather than letting the API refuse means the person gets an answer to a long paste instead of
 * an error about a limit they have no way to know.
 */
const THOUGHT = z.object({
  utterance: z.string().trim().min(1).max(INSTRUCTION_MAX),
  history: z.array(z.string().max(INSTRUCTION_MAX)).max(HISTORY_MAX).default([]),
})

export function parseThought(value: unknown): AssistantThought {
  return THOUGHT.parse(value)
}
