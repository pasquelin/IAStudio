import { useEffect } from 'react'
import { create } from 'zustand'
import { isWorn } from '@shared/domain/scene'
import { isMtlxDocument } from '@shared/domain/materialX'
import { materialFromPayload } from '@/app/materialDocument'
import { channelOfInput } from '@/engines/material/mtlxMaterial'
import type { MaterialState } from '@/engines/material/materialState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { withoutKey } from '@/helpers/objects'
import { useAssets } from './assets'
import { useDocuments } from './documents'
import { materialOf, materialStore, useMaterials } from './materials'

/** A copy read off disk, and whether that read found everything its file names. */
type Copy = { material: MaterialState; whole: boolean; against: Resolvers }

type MaterialSourcesState = {
  /** Keyed by document id, and holding only materials NO tab has open — see `wornMaterialOf`. */
  copies: Record<string, Copy>
  /** Which reads are in flight, so a scene asking per node reads the file once. */
  reading: Set<string>
  install: (materialId: string, material: MaterialState, whole: boolean) => void
  begin: (materialId: string) => boolean
}

/**
 * The materials a scene dresses its models with, whose document is not open in a tab.
 *
 * The sibling of `sceneSources`, and for the same reason: a model NAMES a material, so reading
 * the scene means resolving that name against the file as it is now. The open tab wins whenever
 * there is one — that is where edits land — and this holds the other case, read off disk once.
 *
 * Deliberately NOT written back to: nothing here edits a material.
 */
export const useMaterialSources = create<MaterialSourcesState>()((set, get) => ({
  copies: {},
  reading: new Set(),

  install: (materialId, material, whole) =>
    set(state => ({
      copies: { ...state.copies, [materialId]: { material, whole, against: resolvers() } },
    })),

  begin: materialId => {
    if (get().reading.has(materialId)) return false
    get().reading.add(materialId)
    return true
  },
}))

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
    forget(materialId)
    return materialOf(open, materialId)
  }

  const copy = useMaterialSources.getState().copies[materialId]
  if (!copy) return null
  if (usable(copy)) return copy.material

  // Dropped so the next ask reads the file again — and only from here: `forget` writes to a
  // store, which a component asking the same question during its render may not do.
  forget(materialId)
  return null
}

/**
 * Whether a copy still answers for its document. A read that did NOT find every picture its file
 * names, against a listing or a catalogue that has moved since, came too early.
 */
const usable = (copy: Copy): boolean => copy.whole || !moved(copy.against)

/** The two things a `.mtlx` path is resolved against, as identities. */
type Resolvers = { shelf: readonly Asset[]; listing: readonly DocumentDescriptor[] }

const resolvers = (): Resolvers => ({
  shelf: useAssets.getState().items,
  listing: useDocuments.getState().stored,
})

/**
 * Whether the read was BLIND — nothing to resolve a path against — and one of the two has landed
 * since. A read that had both and still missed a picture names a file that is simply gone: retried
 * on every move of the catalogue, it would re-read its document five times a second during an
 * ingest, and never answer any better.
 */
const moved = ({ shelf, listing }: Resolvers): boolean =>
  (shelf.length === 0 && useAssets.getState().items.length > 0) ||
  (listing.length === 0 && useDocuments.getState().stored.length > 0)

/**
 * Reads a material a scene names but no tab holds. Once per document: a failure leaves the model
 * wearing the maps its own file carries rather than retrying on every frame.
 */
export async function loadMaterialSource(materialId: string): Promise<void> {
  const bridge = getBridge()
  if (!bridge || !useMaterialSources.getState().begin(materialId)) return

  try {
    const file = await bridge.documents.read(materialId, 'material')
    // PARSED, like the door an open tab comes through: `DocumentFile.content` is the serialized
    // text, and a reader handed the string finds no record in it — so it answered an empty
    // material, and every model wearing a document nobody had opened went back to its own maps.
    if (!file) return

    const payload: unknown = JSON.parse(file.content)
    const material = materialFromPayload(payload, materialId)
    // The READ is what knows whether it found everything — the alternative is guessing it back
    // from an empty channel set, which cannot tell a material that names no picture at all.
    useMaterialSources.getState().install(materialId, material, whole(payload, material))
  } catch (error) {
    // The flag goes back, or a file caught mid-rewrite by another window is never read again.
    useMaterialSources.getState().reading.delete(materialId)
    reportFailure('document.load', materialId, error)
  }
}

/** Whether every picture the file NAMES came back with an asset behind it. */
function whole(payload: unknown, material: MaterialState): boolean {
  if (!isMtlxDocument(payload)) return true

  const named = new Set(payload.images.map(image => channelOfInput(image.input)))
  named.delete(undefined)
  return [...named].every(channel => channel && material.channels[channel]?.assetId)
}

function forget(materialId: string): void {
  const held = useMaterialSources.getState()
  if (!(materialId in held.copies) && !held.reading.has(materialId)) return

  held.reading.delete(materialId)
  useMaterialSources.setState({ copies: withoutKey(held.copies, materialId) })
}

/**
 * The material a document id names, as a PANEL reads it: the open tab's if there is one, the copy
 * read off disk otherwise, and `null` while neither has arrived.
 *
 * The reactive half of `wornMaterialOf`, which engines call and which subscribes to nothing. Both
 * halves answer a stable reference, so joining them costs no snapshot.
 */
export function useWornMaterial(materialId: string): MaterialState | null {
  const open = useMaterials(state =>
    materialStore.hasState(state, materialId) ? materialOf(state, materialId) : null,
  )
  const copy = useMaterialSources(state => state.copies[materialId] ?? null)

  // In an effect, never during the render: reading a file is not something a paint does. And not
  // for an EMPTY slot, which names no document — the read would fail and file a line saying so.
  useEffect(() => {
    if (!open && isWorn(materialId)) void loadMaterialSource(materialId)
  }, [materialId, open, copy])

  // The same reading the engine applies, minus its side effect: a panel showing a copy the
  // viewport has just thrown away is two surfaces contradicting each other about one document.
  return open ?? (copy && usable(copy) ? copy.material : null)
}
