import type { PbrChannel } from '@shared/domain/material'

/**
 * Where a derivation stands, as one value rather than three booleans that could contradict one
 * another. `missing` and `blocked` are offered and refused rather than hidden: each names what is
 * in the way, and a row that simply is not there leaves nothing to read that from.
 *
 * **The row is in a context menu, so none of the four is on screen until it is opened.** That is
 * the price of a property line: its gutter holds browsing and clearing, and a third button would
 * end this section on a column no other line of the panel ends on.
 */
export type DerivationState = 'ready' | 'missing' | 'running' | 'blocked'

/**
 * What this channel can compute itself from, when anything can. `null` for the four a shader
 * has no recipe for — offering the row there would promise a result nothing can produce.
 */
export type ChannelDerivation = {
  source: PbrChannel
  state: DerivationState
  run: () => void
}

export const DERIVE_LABELS: Record<DerivationState, string> = {
  ready: 'material.derive',
  missing: 'material.deriveMissing',
  running: 'material.deriving',
  blocked: 'material.deriveBusy',
}
