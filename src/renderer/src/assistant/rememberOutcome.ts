import i18next from 'i18next'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import { MEMORY_WORTH } from '@shared/domain/memoryWorth'
import { MEMORY_SUMMARY_MAX, type MemoryDraft } from '@shared/domain/assistantMemory'
import { orElse } from '@shared/promises'
import { memoryBridge } from '@/services/bridge'

/**
 * Hung on `runAction` and not on `runConfirmedAction`: the latter is exported, and a gesture that
 * skipped it would be a gesture nothing remembered — both the window and the MCP wire cross the
 * former (`executor.ts`).
 */

/**
 * Never awaited and never allowed to throw: a memory that would not persist must not turn a
 * successful call into a refusal.
 *
 * 🛑 Nothing captures WHICH project the action ran in: the write lands in whatever `'project'`
 * names when it arrives. A client chaining `script.write` then `project.open` files the first
 * memory in the second project, and nothing says so.
 */
export async function rememberOutcome(
  name: ActionName,
  input: Record<string, unknown>,
  outcome: ActionOutcome,
): Promise<boolean> {
  // A refused action changed nothing, so there is nothing it taught.
  if (!outcome.ok) return false

  const rule = MEMORY_WORTH[name]
  if (rule === null) return false

  const drawn = rule.draft(input)
  if (drawn === null) return false

  /**
   * Resolved HERE, in the person's language: the summary is what Réglages ▸ Mémoire shows them.
   *
   * 🛑 `escapeValue: false` HERE and not left to the window's own setup: this sentence goes into
   * a file a project carries, never into HTML, and escaping turned `Scripts/Cam.ts` into
   * `Scripts&#x2F;Cam.ts` — a path no anchor would ever match again.
   */
  const summary = withinSummary(
    i18next.t(drawn.summaryKey, { ...drawn.values, interpolation: { escapeValue: false } }),
  )
  // A sentence the studio cannot write is not a memory: without one, `parseMemoryDraft` would
  // throw in the main process and `orElse` would swallow it without a word.
  if (summary === null) return false

  const draft: MemoryDraft = {
    type: drawn.type,
    summary,
    importance: drawn.importance,
    source: { kind: 'action', ref: name },
    ...(drawn.refs ? { refs: drawn.refs } : {}),
  }

  return (await orElse(memoryBridge()?.remember('project', draft), null)) !== null
}

/**
 * 🛑 Cut rather than refused: a rule interpolates a value the action does not bound — `git.commit`
 * takes a `longText` message, and this repository's own convention gives commits a body. Over the
 * cap `parseMemoryDraft` throws in the main process, `orElse` swallows it, and the memory is never
 * written with nothing said.
 *
 * `unknown` in, and nothing for what is not a sentence: `t` answers no string where i18next was
 * never initialised — which is every bench run, and reading `.length` off it threw OUT of the
 * `void` this is called on.
 */
const withinSummary = (summary: unknown): string | null => {
  if (typeof summary !== 'string' || summary.trim() === '') return null

  return summary.length <= MEMORY_SUMMARY_MAX
    ? summary
    : `${summary.slice(0, MEMORY_SUMMARY_MAX - 1)}…`
}
