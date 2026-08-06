import type { StudioBridge } from '@shared/ipc'

/**
 * Single accessor for the preload bridge. It is absent in tests and in a plain browser, and
 * repeating `typeof studio === 'undefined'` in every hook would spread that knowledge — and
 * would contradict the global declaration, which types `studio` as always present.
 */
export function getBridge(): StudioBridge | null {
  return typeof studio === 'undefined' ? null : studio
}
