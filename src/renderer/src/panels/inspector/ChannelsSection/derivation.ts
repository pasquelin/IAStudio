import type { PbrChannel } from '@shared/domain/texture'

/**
 * Where a derivation stands, as one value rather than three booleans that could contradict one
 * another. `missing` and `blocked` are offered and refused rather than hidden: each names what
 * is in the way, and a row that simply is not there leaves nothing to read that from.
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
  ready: 'texture.derive',
  missing: 'texture.deriveMissing',
  running: 'texture.deriving',
  blocked: 'texture.deriveBusy',
}
