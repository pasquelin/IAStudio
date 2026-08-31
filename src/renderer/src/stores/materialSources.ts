import { useEffect } from 'react'
import { isMtlxDocument } from '@shared/domain/materialX'
import { isWorn } from '@shared/domain/scene'
import { materialFromPayload } from '@/features/shell/materialDocument'
import { channelOfInput } from '@/engines/material/mtlxMaterial'
import type { MaterialState } from '@/engines/material/materialState'
import { createDocumentSource } from './documentSource'
import { PATH_RESOLVERS } from './pathResolvers'
import { materialOf, materialStore, useMaterials } from './materials'

/**
 * The materials a scene dresses its models with, whose document is no tab's. Deliberately NOT
 * written back to: nothing here edits a material.
 */
const materials = createDocumentSource({
  kind: 'material',
  parse: materialFromPayload,
  // The READ is what knows whether it found everything — the alternative is guessing it back from
  // an empty channel set, which cannot tell a material that names no picture at all.
  whole: resolvedEvery,
  ...PATH_RESOLVERS,
})

/** Whether every picture the file NAMES came back with an asset behind it. */
function resolvedEvery(state: MaterialState, payload: unknown): boolean {
  if (!isMtlxDocument(payload)) return true

  const named = new Set(payload.images.map(image => channelOfInput(image.input)))
  named.delete(undefined)
  return [...named].every(channel => channel && state.channels[channel]?.assetId)
}

/**
 * The material a model should wear for a document id: the open tab's if there is one, the copy
 * read off disk otherwise, and `null` while neither has arrived.
 *
 * A plain function over both stores rather than a hook — engines subscribe to nothing.
 */
export function wornMaterialOf(materialId: string): MaterialState | null {
  const open = useMaterials.getState()
  if (materialStore.hasState(open, materialId)) {
    // The copy is dropped while a tab holds the document, so closing that tab re-reads the file
    // rather than falling back on what was on disk before it was edited.
    materials.forget(materialId)
    return materialOf(open, materialId)
  }

  return materials.copyOf(materialId)
}

/** Reads a material a scene names but no tab holds. Once per document. */
export const loadMaterialSource = materials.load

/**
 * BOTH halves of « a material moved », as `onSkyChange` is for a sky: the open tab, where the
 * edits land, and the copy read off disk, whose landing nothing else waits for.
 *
 * WHICH documents, rather than « some »: a redraw marks the shadows stale, and a scene of twenty
 * models would pay for a slider dragged in another tab.
 */
export function onMaterialChange(listen: (materialIds: readonly string[]) => void): () => void {
  const tabs = useMaterials.subscribe((state, before) => {
    if (state.states === before.states) return

    const changed = Object.keys(state.states).filter(id => state.states[id] !== before.states[id])
    // A document CLOSING is a change too, and its id is gone from the new states — the model
    // wearing it has to fall back on the file, so what left counts as much as what moved.
    const closed = Object.keys(before.states).filter(id => !(id in state.states))
    if (changed.length + closed.length > 0) listen([...changed, ...closed])
  })

  const files = materials.subscribe(landed => listen(landed))

  return () => {
    tabs()
    files()
  }
}

/**
 * The material a document id names, as a PANEL reads it: the open tab's, the copy read off disk,
 * or `null`. The reactive half of `wornMaterialOf`, which engines call and which subscribes to
 * nothing.
 */
export function useWornMaterial(materialId: string): MaterialState | null {
  const open = useMaterials(state =>
    materialStore.hasState(state, materialId) ? materialOf(state, materialId) : null,
  )
  // Whether a TAB holds it, never the tab's CONTENT, as `useSkySource` keeps it: the effect below
  // would otherwise tear down and set up again on every value a drag emits in that tab.
  const held = open !== null
  const copy = materials.useCopyOf(materialId)

  // In an effect, never during the render: reading a file is not something a paint does. And not
  // for an EMPTY slot, which names no document — the read would fail and file a line saying so.
  useEffect(() => {
    if (!held && isWorn(materialId)) void loadMaterialSource(materialId)
  }, [materialId, held, copy])

  return open ?? copy
}
