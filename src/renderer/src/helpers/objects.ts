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

/**
 * Whether two values hold the same thing, nested objects included.
 *
 * `changedFields` compares by identity, which is what an edit needs and not what a comparison
 * against something read back from disk needs: a material's tiling is a `Vector2`, so a settings
 * object reloaded from a file never matches the one in memory field by field.
 */
export function sameValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || typeof right !== 'object' || !left || !right) return false

  if (Array.isArray(left) !== Array.isArray(right)) return false

  const names = Object.keys(left)
  if (names.length !== Object.keys(right).length) return false

  return names.every(
    name =>
      name in right &&
      sameValues((left as Record<string, unknown>)[name], (right as Record<string, unknown>)[name]),
  )
}
