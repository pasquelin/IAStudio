import type { ActionName, ActionOutcome } from '@shared/domain/assistant'

/**
 * What one action does, once its input has been checked against `fields`.
 *
 * A handler may therefore read its input plainly — the shape is already known to fit the
 * registry. What it may not assume is meaning: a `documentId` that parses is still a document
 * that may have been closed, which is why every handler answers a refusal rather than throwing.
 */
export type ActionHandler = (
  input: Record<string, unknown>,
) => ActionOutcome | Promise<ActionOutcome>

/**
 * One family's share of the table.
 *
 * `Partial` because a family covers its own names and no others; the whole is assembled in
 * `executor.ts`, and `executor.test.ts` holds it to the registry in both directions — an action
 * published with nothing behind it would answer `badInput` to every client that tried it.
 */
export type ActionHandlers = Partial<Record<ActionName, ActionHandler>>
