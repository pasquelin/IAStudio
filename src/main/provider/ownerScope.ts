import type { CloudAsset } from '@shared/domain/cloudAsset'
import type { WatchCredentials } from './credentialsWatch'

export type OwnerScope = {
  /** The project the active key opens onto, or `null` while nothing has said which. */
  current: () => string | null
  /** Records what the library just reported about itself. */
  observe: (assets: readonly CloudAsset[]) => void
}

/**
 * Which project the current key belongs to, learned by watching rather than asked for.
 *
 * There is no `/projects` endpoint: an API key carries its own project, and the only place that
 * project is ever named is `ownerId` on the assets the key returns. So it is read off the first
 * answer that carries one and kept until the credentials change.
 *
 * It matters because the same asset id means nothing under another key. Without this, an asset
 * pushed under one key would read as synchronised under the next, against a library that has
 * never heard of it — which is exactly what `assetBadgeOf` and `planSync` need to rule out.
 *
 * `null` is a real answer, and both of them treat it as "do not judge ownership at all" rather
 * than as a mismatch: before the first listing, nothing is known, and guessing would be worse.
 */
export function createOwnerScope(watch: WatchCredentials): OwnerScope {
  let owner: string | null = null

  // The whole point of the value is that it belongs to one key.
  watch(() => {
    owner = null
  })

  return {
    current: () => owner,
    observe: assets => {
      if (owner !== null) return

      const found = assets.find(asset => asset.ownerId.length > 0)
      if (found) owner = found.ownerId
    },
  }
}
