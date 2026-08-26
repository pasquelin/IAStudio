import { create } from 'zustand'
import { materialFromPayload } from '@/app/materialDocument'
import type { MaterialState } from '@/engines/material/materialState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { materialOf, materialStore, useMaterials } from './materials'

type MaterialSourcesState = {
  /** Keyed by document id, and holding only materials NO tab has open — see `wornMaterialOf`. */
  materials: Record<string, MaterialState>
  /** Which reads are in flight, so a scene asking per node reads the file once. */
  reading: Set<string>
  install: (materialId: string, material: MaterialState) => void
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
const useMaterialSources = create<MaterialSourcesState>()((set, get) => ({
  materials: {},
  reading: new Set(),

  install: (materialId, material) =>
    set(state => ({ materials: { ...state.materials, [materialId]: material } })),

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

  return useMaterialSources.getState().materials[materialId] ?? null
}

/**
 * Reads a material a scene names but no tab holds. Once per document: a failure leaves the model
 * wearing the maps its own file carries rather than retrying on every frame.
 */
export async function loadMaterialSource(materialId: string): Promise<void> {
  const bridge = getBridge()
  if (!bridge || !useMaterialSources.getState().begin(materialId)) return

  try {
    const file = await bridge.documents.read(materialId, 'material')
    if (file) {
      useMaterialSources
        .getState()
        .install(materialId, materialFromPayload(file.content, materialId))
    }
  } catch (error) {
    reportFailure('document.load', materialId, error)
  }
}

function forget(materialId: string): void {
  const held = useMaterialSources.getState()
  if (!(materialId in held.materials) && !held.reading.has(materialId)) return

  const materials = { ...held.materials }
  delete materials[materialId]
  held.reading.delete(materialId)
  useMaterialSources.setState({ materials })
}
