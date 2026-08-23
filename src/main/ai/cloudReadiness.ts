import { CLOUD_IDS, type CloudProviderId } from '@shared/domain/aiCloud'

/**
 * Which registered clouds have an active key behind them.
 *
 * Takes the set the account listing already answers rather than asking cloud by cloud: each ask
 * decrypted the keychain, so this sat on every compose at eight decryptions instead of one.
 *
 * **Blind spot, written rather than hidden**: nothing checks that every registered cloud can
 * appear here — one the listing never names simply never reads as ready, which is the honest
 * answer until something can actually talk to it.
 */
export function readyCloudsOf(held: ReadonlySet<string>): readonly CloudProviderId[] {
  return CLOUD_IDS.filter(id => held.has(id))
}
