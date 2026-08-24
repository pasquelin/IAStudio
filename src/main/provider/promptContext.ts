import type { JobTarget } from '@shared/domain/job'
import type { FieldDescriptor } from '@shared/domain/model'
import {
  bodyWithContext,
  composedContext,
  type ContextCard,
  type ContextualBody,
  type ContextUse,
} from '@shared/domain/projectContext'

export type PromptContext = (
  body: Record<string, unknown>,
  target: JobTarget,
  use: ContextUse,
) => Promise<ContextualBody>

export type PromptContextDeps = {
  cards: () => Promise<readonly ContextCard[]>
  fieldsOf: (targetId: string) => Promise<readonly FieldDescriptor[]>
  log: (message: string) => void
}

/**
 * The ONE place a context joins a body, which is what keeps the estimate and the generation
 * quoting the same one. 🛑 It never throws: a generation being paid for must not die on a
 * preference, so every failure answers the body untouched and writes a line.
 */
export function createPromptContext(deps: PromptContextDeps): PromptContext {
  return async (body, target, use) => {
    if (use === 'skip') return { body, authored: null }

    try {
      const context = composedContext(await deps.cards())
      if (context.length === 0) return { body, authored: null }

      return bodyWithContext(body, await deps.fieldsOf(target.id), context)
    } catch (error) {
      deps.log(`could not read the project context: ${String(error)}`)
      return { body, authored: null }
    }
  }
}
