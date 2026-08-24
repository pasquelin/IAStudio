import { z } from 'zod'
import {
  ACTION_REFUSALS,
  HISTORY_MAX,
  INSTRUCTION_MAX,
  type AssistantThought,
} from '@shared/domain/assistant'
import { TARGET_ID_MAX, TARGET_KINDS, TARGET_NAME_MAX, TARGETS_MAX } from '@shared/domain/target'
import type { AssistantActionResult } from '@shared/ipc'

/**
 * What a window may ask the assistant to think about.
 *
 * Bounded on both counts, and the bounds are the model's own: an instruction over ten thousand
 * characters is answered with a 400, and only ten blocks of history are carried. Cutting here
 * rather than letting the API refuse means the person gets an answer to a long paste instead of
 * an error about a limit they have no way to know.
 */
const TARGET = z.object({
  id: z.string().min(1).max(TARGET_ID_MAX),
  kind: z.enum(TARGET_KINDS),
  name: z.string().max(TARGET_NAME_MAX),
  selected: z.boolean(),
})

const THOUGHT = z.object({
  utterance: z.string().trim().min(1).max(INSTRUCTION_MAX),
  history: z.array(z.string().max(INSTRUCTION_MAX)).max(HISTORY_MAX).default([]),
  /**
   * Bounded HERE as well as at the window, because a caller that is not the window can reach this
   * too: the briefing has some three thousand characters of room and this is what could eat them.
   */
  targets: z.array(TARGET).max(TARGETS_MAX).default([]),
})

export function parseThought(value: unknown): AssistantThought {
  return THOUGHT.parse(value)
}

/**
 * What a window answers when it has run — or refused — an action asked for from outside.
 *
 * `data` is left as `unknown`: it is whatever the action had to say, a list of models or a job
 * id, and the shape belongs to the action rather than to this boundary. It reaches an MCP
 * client as JSON and nothing here reads it.
 */
const ACTION_RESULT = z.object({
  callId: z.string().min(1),
  outcome: z.union([
    z.object({ ok: z.literal(true), data: z.unknown().optional() }),
    z.object({ ok: z.literal(false), refusal: z.enum(ACTION_REFUSALS) }),
  ]),
})

export function parseActionResult(value: unknown): AssistantActionResult {
  return ACTION_RESULT.parse(value)
}
