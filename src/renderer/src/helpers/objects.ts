/**
 * What an edit actually moved, field by field.
 *
 * A control reports the whole object it was handed, changed — which is all a single target
 * needs. Writing that object onto a second one would carry the fields the control never showed
 * with it, so what is written elsewhere is the difference rather than the whole.
 */
export function changedFields<D extends object>(before: D, after: D): Partial<D> {
  const changes: Partial<D> = {}
  for (const name in after) if (!Object.is(before[name], after[name])) changes[name] = after[name]
  return changes
}
