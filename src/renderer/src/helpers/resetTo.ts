/**
 * The handler a `ResetButton` takes, or `undefined` where the value already stands at its default
 * — which leaves the button drawn and INERT rather than absent, so no field narrows under the
 * pointer the moment its value moves.
 *
 * `apply` rather than a value written back: a reset puts one member back on a whole object, and
 * the caller alone knows whether that goes through a command, a store or a preference.
 */
export function resetTo<T>(
  value: T,
  fallback: T | undefined,
  apply: (fallback: T) => void,
): (() => void) | undefined {
  return fallback === undefined || fallback === value ? undefined : () => apply(fallback)
}
