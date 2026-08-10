import { evaluateCel } from '@scenario-labs/sdk/tools/cel'
import type { GraphTransformVariables } from '@shared/domain/graph'
import { messageOf } from '@shared/guards'
import type { TransformVerdict } from './transform-protocol'

/**
 * What one `transformText` node computes, evaluated by Scenario's OWN CEL environment — the
 * adapter and nothing else, exactly as `workflow-compile.ts` is for the converter.
 *
 * **Pure, and it has to be: this runs on a worker thread** (`transform-worker.ts`). CEL exposes
 * `matches()`, which is JavaScript's own `RegExp` — a backtracking pattern over thirty characters
 * was measured taking 75 seconds of solid CPU, and nothing interrupts a synchronous regex.
 */
export function runTransform(
  expression: string,
  variables: GraphTransformVariables,
): TransformVerdict {
  let result: unknown

  try {
    result = evaluateCel(expression, variables)
  } catch (error) {
    return { ok: false, reason: `${expression}: ${messageOf(error)}` }
  }

  const values = asValues(result)
  if (!values) return { ok: false, reason: `${expression}: result is not text` }

  return { ok: true, values }
}

/**
 * A CEL result as the values a wire carries, or `null` where it is neither text nor a list of it.
 *
 * **`bigint` is in the table because CEL answers with one**, measured rather than assumed:
 * `evaluateCel('1 + 1')` returns `2n`, and a template built around a count would otherwise fail
 * on a node that computed perfectly well. `null`, maps and nested lists are refused instead of
 * being stringified — `[object Object]` in a prompt is a generation paid for and thrown away.
 *
 * A list is carried over ENTIRELY, blanks included: dropping them would change its length, and a
 * `['', 'b']` silently becoming `['b']` makes `[0]` answer `'b'` here and `''` on a published App.
 * A lone empty string is the one thing that answers no value at all — `asList`'s rule in the
 * executor, and the same reason: a wire carrying nothing must not overwrite what a form holds.
 */
function asValues(result: unknown): readonly string[] | null {
  if (Array.isArray(result)) {
    const items: string[] = []

    for (const item of result) {
      const text = asText(item)
      if (text === null) return null
      items.push(text)
    }

    return items
  }

  const text = asText(result)
  if (text === null) return null

  return text === '' ? [] : [text]
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}
