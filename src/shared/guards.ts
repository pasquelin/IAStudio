/**
 * `typeof null === 'object'`, so a bare `typeof value === 'object'` hands `null` through. Every
 * store rehydrating persisted state needs this narrowing, and each one writing it by hand is how
 * two of them ended up letting `null` reach zustand's merge.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Reading one field off something that came back from disk or from a store. Three readers
 * rather than a generic merge: a document written by an older build must open on the current
 * default, and the field is the only place that knows which default that is.
 *
 * `NaN` and `Infinity` are refused as numbers: `JSON.stringify` writes both as `null`, so a
 * file holding one was already unreadable by the time it was written.
 */
export function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readString(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}
