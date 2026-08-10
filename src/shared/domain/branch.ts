import { isGraphConditionOperator, type GraphCondition, type GraphConditionBlock } from './graph'

/**
 * One `ifElse` branch, as the CEL its condition compiles to.
 *
 * **Transcribed from the SDK's own `workflow_converter.js`, not reasoned out**, exactly as
 * `approvals.ts` was — and unlike that file, the transcription is MEASURED:
 * `main/scenario/workflow-compile.test.ts` puts the same blocks through Scenario's own converter
 * and demands our string be its string.
 *
 * Here rather than beside `conditions.ts` because two sides read it: the renderer decides a
 * branch with it, and the main's compiler test measures it. Pure, no runtime dependency — which
 * is the one thing `shared/` asks of what lives in it. A local run that decided a branch differently from the published workflow would be
 * worse than one that refused to decide at all.
 *
 * Why compiling rather than comparing: the converter does not evaluate these operators, it turns
 * each into a CEL expression. The studio already runs CEL — that is the `transform` port every
 * `transformText` goes through — so a branch is decided by the same evaluator, off the same
 * string, as the one Scenario would run.
 */

/** `'…'` with the single quotes CEL doubles rather than escapes. */
const asText = (value: string): string => `'${value.replace(/'/g, "''")}'`

const asPattern = (value: string): string => value.replace(/[.+*?[\]()^$|\\]/g, '\\$&')

/**
 * A value as CEL reads it: a list, a bare number where the text IS a number, text otherwise.
 *
 * The number test is the converter's, down to `String(n) === String(v).trim()` — `'01'` is text,
 * because writing it back gives `'1'`, and a range written `01` must not silently become one.
 */
function asValue(value: string | readonly string[] | undefined): string {
  if (value === undefined) return "''"
  if (Array.isArray(value)) return `[${value.map(item => asText(String(item))).join(', ')}]`

  const only = String(value)
  const parsed = Number(only)
  const numeric = !isNaN(parsed) && only !== '' && String(parsed) === only.trim()

  return numeric ? String(parsed) : asText(only)
}

/**
 * One comparison, over the CEL name its field resolves to.
 *
 * `'false'` for a condition with no field, and for a `between` whose pair is not two numbers —
 * the converter's own answer, and the reason `conditionBlockToCEL` drops those before joining:
 * a branch made only of unreadable conditions compiles to nothing at all, not to `false`.
 */
export function conditionToCel(condition: GraphCondition, field: string): string {
  const { operator, value } = condition

  // The converter's `default: return 'false'`, asked at the door rather than at the bottom of the
  // switch: `blockToCel` is exported from `shared/` and nothing obliges a caller to come through
  // `conditionBlocksOf`, which is the only thing that folds an unknown operator back to `equals`.
  if (!isGraphConditionOperator(operator)) return 'false'

  switch (operator) {
    case 'isEmpty':
      return `${field} == null || size(${field}) == 0 || (type(${field}) != list && trim(${field}) == "")`
    case 'isNotEmpty':
      return `${field} != null && size(${field}) > 0 && (type(${field}) == list || trim(${field}) != "")`
    case 'equals':
      return `trim(${field}) == ${asValue(value)}`
    case 'notEquals':
      return `trim(${field}) != ${asValue(value)}`
    case 'contains':
      return `${field}.matches('.*${asPattern(String(value ?? '')).replace(/'/g, "''")}.*')`
    case 'notContains':
      return `!${field}.matches('.*${asPattern(String(value ?? '')).replace(/'/g, "''")}.*')`
    case 'greaterThan':
      return `${field} > ${asValue(value)}`
    case 'greaterThanOrEqual':
      return `${field} >= ${asValue(value)}`
    case 'lessThan':
      return `${field} < ${asValue(value)}`
    case 'lessThanOrEqual':
      return `${field} <= ${asValue(value)}`
    case 'between':
      return betweenToCel(field, value)
  }
}

function betweenToCel(field: string, value: GraphCondition['value']): string {
  if (!Array.isArray(value) || value.length !== 2) return 'false'

  const [low, high] = [Number(value[0]), Number(value[1])]
  if (isNaN(low) || isNaN(high)) return 'false'

  return `${field} >= ${low} && ${field} <= ${high}`
}

/**
 * A whole branch: its conditions joined by its own logic, over the names its fields resolve to.
 *
 * **Empty means the branch has nothing readable to test**, which is not the same as false: the
 * converter returns `''` there, and what the studio does with that is the caller's to decide —
 * the executor's `route` treats it as a branch that cannot be taken rather than one that always is.
 *
 * `nameOf` is what turns a condition's field — a PROVIDER NODE ID, which is what the inspector
 * writes — into the CEL name that provider's value is bound to. A field naming a node that feeds
 * nothing is NOT dropped: the converter falls back to the raw name, and the case then compiles
 * against a variable the run never declares. Kept, so the studio fails the same way.
 */
export function blockToCel(
  block: GraphConditionBlock,
  nameOf: (field: string) => string | undefined,
): string {
  const parts: string[] = []

  for (const condition of block.conditions) {
    // FALSY, not merely absent: the inspector's own "no field" option writes `''`, and the
    // converter answers `'false'` for it — which `conditionBlockToCEL` then drops. Testing for
    // `undefined` alone compiled `trim() == 'a'`, which the evaluator throws on: the branch went
    // red and blocked everything downstream, on a graph Scenario runs without blinking.
    if (!condition.field) continue

    const compiled = conditionToCel(condition, nameOf(condition.field) ?? condition.field)
    // Dropped rather than joined, which is the converter's own filter: one unreadable condition
    // in an `or` would otherwise make the whole branch false, and in an `and` it already does.
    if (compiled !== 'false') parts.push(compiled)
  }

  // `join` on one part IS that part, so no special case: the converter writes the single form
  // for one condition and the joined form for several, and this answers both.
  return parts.join(block.logic === 'or' ? ' || ' : ' && ')
}
