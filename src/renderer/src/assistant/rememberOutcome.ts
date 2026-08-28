import i18next from 'i18next'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import { MEMORY_WORTH } from '@shared/domain/memoryWorth'
import type { MemoryDraft } from '@shared/domain/assistantMemory'
import { orElse } from '@shared/promises'
import { memoryBridge } from '@/services/bridge'

/**
 * What one action left the studio knowing, written down.
 *
 * Hung on `runAction` and not on `runConfirmedAction`: the latter is exported, and a gesture that
 * skipped it would be a gesture nothing remembered — the window and the MCP wire both cross the
 * former (`executor.ts`).
 */

/**
 * Draws it, sends it, and answers whether anything was written.
 *
 * Never awaited by its caller and never allowed to throw: an action is done when the studio
 * changed, and a memory that would not persist must not turn a successful call into a refusal.
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

  const drawn = rule.draft(input, outcome.data)
  if (drawn === null) return false

  const draft: MemoryDraft = {
    type: drawn.type,
    // Resolved HERE, in the person's language: the summary is what Réglages ▸ Mémoire shows them,
    // so it is a word of the interface and cannot be a sentence written in a table.
    /**
     * 🛑 `escapeValue: false` HERE and not left to the window's own setup: this sentence goes
     * into a file a project carries, never into HTML, and escaping turned `Scripts/Cam.ts` into
     * `Scripts&#x2F;Cam.ts` — a path no anchor would ever match again.
     */
    summary: i18next.t(drawn.summaryKey, {
      ...drawn.values,
      interpolation: { escapeValue: false },
    }),
    importance: drawn.importance,
    source: { kind: 'action', ref: name },
    ...(drawn.refs ? { refs: drawn.refs } : {}),
  }

  return (await orElse(memoryBridge()?.remember('project', draft), null)) !== null
}
