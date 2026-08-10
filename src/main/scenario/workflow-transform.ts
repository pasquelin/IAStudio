import { evaluateCel } from '@scenario-labs/sdk/tools/cel'
import type { GraphTransformVariables } from '@shared/domain/graph'
import { messageOf } from '@shared/guards'

/**
 * What one `transformText` node computes, evaluated by Scenario's OWN CEL environment.
 *
 * **No evaluator is written here.** `evaluateCel` is the entry point the SDK says its backend,
 * its webapp and its MCP server all share, so a local run cannot drift from what a published App
 * computes — this file is the adapter and nothing else, exactly as `workflow-compile.ts` is for
 * the converter.
 *
 * `null` for the three ways it can answer nothing, all reported the same way to the node and
 * apart in the journal: an expression that will not parse, one reading a variable no wire feeds,
 * and one whose result is a shape no port can carry.
 */
export function runTransform(
  expression: string,
  variables: GraphTransformVariables,
  report: (message: string) => void,
): readonly string[] | null {
  let result: unknown

  try {
    result = evaluateCel(expression, variables)
  } catch (error) {
    report(`transform ${expression}: ${messageOf(error)}`)
    return null
  }

  const values = asValues(result)
  if (!values) report(`transform ${expression}: result is not text`)

  return values
}

/**
 * A CEL result as the values a wire carries, or `null` where it is neither text nor a list of it.
 *
 * **`bigint` is in the table because CEL answers with one**, measured rather than assumed:
 * `evaluateCel('1 + 1')` returns `2n`, and a template built around a count would otherwise fail
 * on a node that computed perfectly well. `null`, maps and nested lists are refused instead of
 * being stringified — `[object Object]` in a prompt is a generation paid for and thrown away.
 *
 * An empty string answers no value at all, which is `asList`'s rule in the executor and the same
 * one for the same reason: a wire carrying nothing must not overwrite what the next form holds.
 */
function asValues(result: unknown): readonly string[] | null {
  if (Array.isArray(result)) {
    const items: string[] = []

    for (const item of result) {
      const text = asText(item)
      if (text === null) return null
      if (text !== '') items.push(text)
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
