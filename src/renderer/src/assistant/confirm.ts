import type { ActionCommitment, ActionName } from '@shared/domain/assistant'

/**
 * The question asked before the assistant does anything that outlives the window.
 *
 * Registered by the modal while it is mounted, the way the generator registers its form. Nothing
 * else in the studio may answer it: a confirmation that appeared somewhere the person is not
 * looking is not a confirmation.
 *
 * Deliberately not a `window.confirm`: it blocks the whole renderer, cannot say what a thing
 * costs in the studio's own type, and cannot be styled to look like anything but a browser.
 */
export type ConfirmRequest = {
  action: ActionName
  commitment: ActionCommitment
  /**
   * What it will cost, in creative units. Absent when nothing is spent; `null` when the API
   * declined to say — which the question shows as such rather than filling in with a guess.
   */
  estimate?: number | null
}

export type Confirmer = (request: ConfirmRequest) => Promise<boolean>

let mounted: Confirmer | null = null

/** Declares the modal as the place questions are asked. Returns the way to take it back down. */
export function registerConfirmer(confirmer: Confirmer): () => void {
  mounted = confirmer
  return () => {
    if (mounted === confirmer) mounted = null
  }
}

/** Whoever is able to ask, or `null` when no window is showing the assistant. */
export function mountedConfirmer(): Confirmer | null {
  return mounted
}
