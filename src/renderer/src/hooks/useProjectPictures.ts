import { useMemo } from 'react'
import { posterUrl, type AssetType } from '@shared/domain/asset'
import type { LinkOption } from '@/design/LinkField/LinkField'
import { useProjectPictureAssets } from './useProjectPictureAssets'

/**
 * What a slot OFFERS, which is the project's pictures made pickable.
 *
 * That distinction is the whole reason this exists. The slots used to build their list out of
 * `useAssets.items`, which is the shelf's scope: in the 3D space it is narrowed to meshes, so every
 * texture slot of the inspector offered nothing and refused every click.
 */
export function useProjectPictures(types: readonly AssetType[]): readonly LinkOption[] {
  const pictures = useProjectPictureAssets(types)

  return useMemo(
    () =>
      pictures.map(asset => ({
        id: asset.id,
        name: asset.name,
        url: posterUrl(asset) ?? undefined,
      })),
    [pictures],
  )
}
