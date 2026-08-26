import { useMemo } from 'react'
import type { Asset } from '@shared/domain/asset'
import { QuietNote } from '@/design/QuietNote'
import { hasChannel, type ChannelTexture } from '@shared/domain/ownModelTextures'
import { useDerivedTextures } from '@/hooks/useDerivedTextures'
import { ModelTexturesSectionMaterialRow } from './ModelTexturesSectionMaterialRow'
import { ModelTexturesSectionPackedRow } from './ModelTexturesSectionPackedRow'

function split(textures: readonly Asset[]): {
  channels: ChannelTexture[]
  packed: Asset[]
} {
  const channels: ChannelTexture[] = []
  const packed: Asset[] = []
  for (const texture of textures) {
    if (hasChannel(texture)) channels.push(texture)
    else packed.push(texture)
  }
  return { channels, packed }
}

/**
 * One pass over the same list, held across renders: `ModelTexturesSectionMaterialRow` is memoised
 * and takes `channels` as a prop, so a fresh array each render would defeat the barrier. What
 * `useDerivedTextures` hands back keeps its identity while the catalogue answers the same rows.
 *
 * The empty note arrives already translated so that this component takes no subscription of its
 * own: `useTranslation` re-subscribes to i18next on every render, and the inspector renders on
 * every frame of a gizmo drag. It saves the SECOND subscription, not the first — the section
 * above still holds one for its own title.
 */
export function ModelTexturesSectionList({
  assetId,
  name,
  empty,
}: {
  assetId: string
  name: string
  empty: string
}) {
  const textures = useDerivedTextures(assetId)
  const { channels, packed } = useMemo(() => split(textures), [textures])

  // Said rather than left blank: extraction runs at import with nobody waiting on it, so an empty
  // list is as often "not yet" as "this file carries none".
  if (textures.length === 0) return <QuietNote>{empty}</QuietNote>

  return (
    // Two, like every other stack of this panel — `PROPERTY_BODY` spaces the sections' children
    // by two and these rows are one of them. Flush, they read as one block rather than as a list;
    // by one, `spacing.test.ts` refuses them, and it is right to: the studio has one gap.
    <div className="flex flex-col gap-2">
      {channels.length > 0 && (
        <ModelTexturesSectionMaterialRow assetId={assetId} name={name} channels={channels} />
      )}
      {packed.map(texture => (
        <ModelTexturesSectionPackedRow key={texture.id} texture={texture} />
      ))}
    </div>
  )
}
