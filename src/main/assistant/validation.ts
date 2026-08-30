import { z } from 'zod'
import {
  ACTION_REFUSALS,
  HISTORY_BLOCK_MAX,
  HISTORY_MAX,
  type AssistantThought,
} from '@shared/domain/assistant'
import { DOCUMENT_KINDS } from '@shared/domain/document'
import { TARGET_ID_MAX, TARGET_KINDS, TARGET_NAME_MAX, TARGETS_MAX } from '@shared/domain/target'
import type { StudioSnapshot } from '@shared/domain/studioSnapshot'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import type { AssistantActionResult } from '@shared/ipc'
import { NOTE_TEXT_MAX, type WindowNote } from '@shared/domain/assistantNote'
import { clipped } from '@shared/text'

/**
 * How long a sentence this channel carries — the BOUNDARY's own bound, and no longer a model's.
 *
 * Ten thousand characters because that is where a paste stops being a sentence, not because any
 * door refuses past it: what each brain can hold is now the brain's to say — see `BriefingParts`.
 */
const UTTERANCE_MAX = 10_000

/**
 * What a window may ask the assistant to think about.
 *
 * Bounded on both counts: cutting here rather than letting a cloud refuse means the person gets
 * an answer to a long paste instead of an error about a limit they have no way to know.
 */
const TARGET = z.object({
  id: z.string().min(1).max(TARGET_ID_MAX),
  kind: z.enum(TARGET_KINDS),
  name: z.string().max(TARGET_NAME_MAX),
  selected: z.boolean(),
})

const THOUGHT = z.object({
  utterance: z.string().trim().min(1).max(UTTERANCE_MAX),
  continuing: z.boolean().default(false),
  history: z.array(z.string().max(HISTORY_BLOCK_MAX)).max(HISTORY_MAX).default([]),
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

/**
 * What a window says its chain just did — CUT rather than refused, as `diagnostics/validation.ts`
 * cuts its message: an over-long line is ordinary, and refusing it would make the channel meant
 * to explain a turn fail silently on the turn worth explaining.
 */
const said = z.string().transform(value => clipped(value, NOTE_TEXT_MAX))

const NOTE = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ran'),
    action: said,
    input: said,
    answer: said,
    refused: z.boolean(),
  }),
  z.object({ kind: z.literal('asked'), question: said, answer: said.nullable() }),
]) satisfies z.ZodType<WindowNote>

export function parseNote(value: unknown): WindowNote {
  return NOTE.parse(value)
}

/**
 * What a window answers about the studio itself — `studio.state`, read back on the other side of
 * the boundary.
 *
 * 🛑 `satisfies z.ZodType<StudioSnapshot>` is the whole point: it ties this schema to the shared
 * type, so a field renamed in the window stops compiling here instead of leaving `describeStudio`
 * composing an empty sentence about a studio that is not there.
 */
const SNAPSHOT = z.object({
  project: z
    .object({
      path: z.string(),
      manifest: z.object({
        version: z.number(),
        name: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    })
    .nullable(),
  projectKnown: z.boolean(),
  workspace: z.enum(WORKSPACE_IDS),
  surface: z.string(),
  commandScope: z.string().nullable(),
  documents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(DOCUMENT_KINDS),
      workspace: z.enum(WORKSPACE_IDS),
      path: z.string().nullable(),
      active: z.boolean(),
      modified: z.boolean(),
    }),
  ),
  selection: z
    .object({
      kind: z.enum(TARGET_KINDS),
      items: z.array(z.object({ id: z.string(), name: z.string() })),
    })
    .nullable(),
  armedModels: z.record(z.string(), z.string()),
  authenticated: z.boolean(),
  authKnown: z.boolean(),
}) satisfies z.ZodType<StudioSnapshot>

/** `null` rather than a throw: a window that could not answer leaves the model as blind as before. */
export function parseSnapshot(value: unknown): StudioSnapshot | null {
  const read = SNAPSHOT.safeParse(value)
  return read.success ? read.data : null
}
