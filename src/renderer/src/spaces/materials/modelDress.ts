import type { ModelDress, ModelMaterial, TextureRef, TextureSlot } from '@shared/domain/scene'
import { slotForChannel, type MaterialSettings } from '@shared/domain/material'
import type { ChannelSet, MaterialState } from '@/engines/material/materialState'
import { loadMaterialSource, wornMaterialOf } from '@/stores/materialSources'

/**
 * What a MATERIAL is worth to a model: its channels put in the slots a scene reads, and the dials
 * a plain `MeshStandardMaterial` carries.
 *
 * The cavity is dropped, and so are the two ranges and the green flip: those four are read in the
 * material engine's `onBeforeCompile`, and a scene draws no such shader. Carried across they would
 * promise a look the viewport cannot draw — `ModelMaterial` says the same from the other side.
 */
/**
 * What the material a model names is worth to it — the port every scene takes.
 *
 * Synchronous: the open tab first, then the copy read off disk, and `null` while neither has
 * arrived — with the read fired on the way, so the next frame has it.
 */
export function wornModelDress(materialDocumentId: string): ModelDress | null {
  const state = wornMaterialOf(materialDocumentId)
  if (state) return modelDressOf(state)

  void loadMaterialSource(materialDocumentId)
  return null
}

export function modelDressOf(state: MaterialState): ModelDress {
  return { textures: slotsOf(state.channels), material: modelFinishOf(state.material) }
}

function slotsOf(channels: ChannelSet): Partial<Record<TextureSlot, TextureRef>> {
  const slots: Partial<Record<TextureSlot, TextureRef>> = {}

  for (const [channel, held] of Object.entries(channels)) {
    const slot = slotForChannel(channel as keyof ChannelSet)
    if (slot && held) slots[slot] = { assetId: held.assetId }
  }

  return slots
}

function modelFinishOf(material: MaterialSettings): ModelMaterial {
  return {
    color: material.color,
    roughness: material.roughness,
    metalness: material.metalness,
    normalScale: material.normalScale,
    aoIntensity: material.aoIntensity,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
    tiling: { x: material.tiling.x, y: material.tiling.y },
    offset: { x: material.offset.x, y: material.offset.y },
    rotation: material.rotation,
  }
}
