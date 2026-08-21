import { CLOUD_IDS, type CloudProviderId } from '@shared/domain/aiCloud'

/**
 * One cloud, as the wiring holds it: whether an account is held for it.
 *
 * A member of a bigger table rather than the table itself — the wiring keeps everything it owns
 * for a cloud under one key, so the studio names a cloud in ONE place. This reads the half it
 * needs and ignores the rest.
 */
export type CloudWiring = { held: () => boolean }

/**
 * Which registered clouds have an account behind them.
 *
 * **Blind spot, written rather than hidden**: nothing checks that every registered cloud has a
 * line here — one that has none simply never reads as ready, which is the honest answer until
 * something can actually talk to it.
 */
export function readyCloudsOf(
  clouds: Readonly<Record<string, CloudWiring>>,
): readonly CloudProviderId[] {
  return CLOUD_IDS.filter(id => clouds[id]?.held() === true)
}
