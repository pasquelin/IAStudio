import { CLOUD_IDS, type CloudProviderId } from '@shared/domain/aiCloud'

/** Whether the studio holds an account for one cloud. Asked, never cached: a key comes and goes. */
export type CredentialCheck = () => boolean

/**
 * Which registered clouds have an account behind them.
 *
 * A table keyed by cloud id, so the wiring names a cloud where it OWNS its credentials and
 * nowhere else. **Blind spot, written rather than hidden**: nothing checks that every registered
 * cloud has a line here — one that has none simply never reads as ready, which is the honest
 * answer until something can actually talk to it.
 */
export function readyCloudsOf(
  checks: Readonly<Record<string, CredentialCheck>>,
): readonly CloudProviderId[] {
  return CLOUD_IDS.filter(id => checks[id]?.() === true)
}
