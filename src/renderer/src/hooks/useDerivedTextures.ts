import { useCallback, useEffect, useRef, useState } from 'react'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'
import { useShelfRefresh } from './useShelfRefresh'

/** One value rather than a fresh array per read: an empty answer must not re-render its reader. */
const NO_TEXTURE: readonly Asset[] = []

/**
 * The pictures taken OUT of one asset — a model's own maps, above all.
 *
 * Asked of the catalogue rather than filtered out of `useAssets`: that shelf is scoped by the
 * space in front and capped, so a model's own pictures would be there in 3D and gone the moment
 * someone narrowed the browser to meshes. `derivedFrom` is indexed; this is one query.
 *
 * Read again on every catalogue read, and that is what makes the grid fill itself: extraction
 * runs on import without anybody waiting for it, so a model dropped in the scene has no picture
 * for a second or two — and a panel that only read once would stay empty until reselected.
 */
export function useDerivedTextures(sourceId: string | undefined): readonly Asset[] {
  const [textures, setTextures] = useState<readonly Asset[]>(NO_TEXTURE)
  const [shown, setShown] = useState(sourceId)
  // What the reads in flight are answering for. Two can be out at once — the shelf re-reads on
  // every write to the catalogue — so the slower one must not dress a model with the pictures of
  // the one selected before it.
  const asked = useRef(sourceId)

  // Emptied during the render rather than after it, as `useShelf` does: kept on screen, the tiles
  // of the previous model stay clickable, and they open ITS pictures.
  if (shown !== sourceId) {
    setShown(sourceId)
    setTextures(NO_TEXTURE)
  }

  const read = useCallback(() => {
    if (!sourceId) return

    void getBridge()
      ?.assets.search({ derivedFrom: sourceId, type: 'texture' })
      .then(found => {
        if (asked.current === sourceId) setTextures(found)
      })
      // No project open: the catalogue throws, and no picture is the honest answer.
      .catch(() => undefined)
  }, [sourceId])

  useEffect(() => {
    asked.current = sourceId
    read()
  }, [sourceId, read])

  useShelfRefresh(read)

  return textures
}
