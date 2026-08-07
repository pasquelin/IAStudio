/**
 * `typeof null === 'object'`, so a bare `typeof value === 'object'` hands `null` through. Every
 * store rehydrating persisted state needs this narrowing, and each one writing it by hand is how
 * two of them ended up letting `null` reach zustand's merge.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
