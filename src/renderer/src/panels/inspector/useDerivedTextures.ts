import { useCallback, useEffect, useState } from 'react'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'

const NO_TEXTURE: readonly Asset[] = []

/**
 * The stamp as much as the id: an id does not move when ⌘S rewrites the picture behind it, and
 * the tile draws its URL off `localChangedAt` (`posterUrl`) precisely so an edit repaints. Keying
 * on the id alone left the inspector showing the picture from before it was painted.
 */
const sameRows = (held: readonly Asset[], found: readonly Asset[]): boolean =>
  held.length === found.length &&
  held.every(
    (asset, index) =>
      asset.id === found[index]?.id && asset.localChangedAt === found[index]?.localChangedAt,
  )

/**
 * The pictures taken OUT of one asset — a model's own maps, above all.
 *
 * Asked of the catalogue rather than filtered out of `useAssets`: that shelf is scoped by the
 * space in front, so a model's own pictures would be there in 3D and gone the moment someone
 * narrowed the browser to meshes. `derivedFrom` is indexed; this is one query.
 *
 * Read again on every catalogue read, and that is what makes the grid fill itself: extraction
 * runs on import without anybody waiting for it, so a model dropped in the scene has no picture
 * for a second or two — and a panel that only read once would stay empty until reselected. Not
 * `useShelf`, whose `retry` empties what it holds and starts over: every write to the catalogue
 * would blink the tiles, and an import is twenty of them.
 *
 * What is held is keyed by the source it answers for, so a slower read cannot dress a model with
 * the pictures of the one selected before it — two are out at once on the read after an import.
 */
export function useDerivedTextures(sourceId: string): readonly Asset[] {
  const [held, setHeld] = useState<{ source: string; textures: readonly Asset[] }>({
    source: sourceId,
    textures: NO_TEXTURE,
  })

  // Emptied during the render rather than after it, as `useShelf` does: left on screen, the tiles
  // of the previous model stay clickable, and they open ITS pictures.
  if (held.source !== sourceId) setHeld({ source: sourceId, textures: NO_TEXTURE })

  const read = useCallback((): void => {
    void getBridge()
      ?.assets.search({ derivedFrom: sourceId, type: 'texture' })
      .then(found =>
        setHeld(current =>
          // Same rows, same object: the shelf is re-read on every write to the catalogue, and a
          // fresh array each time would re-render the grid through a whole import.
          current.source !== sourceId || sameRows(current.textures, found)
            ? current
            : { source: sourceId, textures: found },
        ),
      )
      // No project open: the catalogue throws, and no picture is the honest answer.
      .catch(() => undefined)
  }, [sourceId])

  useEffect(read, [read])
  useShelfRefresh(read)

  return held.source === sourceId ? held.textures : NO_TEXTURE
}
