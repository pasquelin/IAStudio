import { useEffect } from 'react'
import { isMtlxDocument } from '@shared/domain/materialX'
import { isWorn } from '@shared/domain/scene'
import { materialFromPayload } from '@/app/materialDocument'
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

/** Every landing of a read, so a viewport can dress again what it had to leave undressed. */
export const onMaterialsRead = materials.subscribe

/**
 * The material a document id names, as a PANEL reads it: the open tab's, the copy read off disk,
 * or `null`. The reactive half of `wornMaterialOf`, which engines call and which subscribes to
 * nothing.
 */
export function useWornMaterial(materialId: string): MaterialState | null {
  const open = useMaterials(state =>
    materialStore.hasState(state, materialId) ? materialOf(state, materialId) : null,
  )
  const copy = materials.useCopyOf(materialId)

  // In an effect, never during the render: reading a file is not something a paint does. And not
  // for an EMPTY slot, which names no document — the read would fail and file a line saying so.
  useEffect(() => {
    if (!open && isWorn(materialId)) void loadMaterialSource(materialId)
  }, [materialId, open, copy])

  return open ?? copy
}
