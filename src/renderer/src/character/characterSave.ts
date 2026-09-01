import type { CharacterExtras } from '@shared/domain/character'
import type { GlbSkinPatch } from '@/engines/scene/glbSkin'
import type { CharacterState } from '@/engines/character/characterState'
import { createGlbWriter, type GlbWriter } from '@/engines/scene/glbWriter'
import type { StudioBridge } from '@shared/ipc'
import { fetchAsset } from '@/helpers/assetFetch'
import { getBridge } from '@/services/bridge'
import { characterOf, characterStore } from '@/stores/character'
import GlbWriteWorker from '@/engines/scene/glbWrite.worker?worker'

/** What the weights of one mesh are, once the engine has worked them out. */
export type CharacterSkinning = GlbSkinPatch['skins']

/**
 * Writing a character back: its own file, patched with the skeleton it now carries.
 *
 * 🛑 The container is patched rather than re-exported — see `glbSkin`. Off the UI thread, because
 * a character of a million triangles is tens of megabytes of container to rebuild.
 */
export async function saveCharacter(assetId: string, skins: CharacterSkinning): Promise<boolean> {
  const bridge = getBridge()
  const state = characterOf(characterStore.use.getState(), assetId)
  if (!bridge || !state.rig) return false

  // One save at a time: a second ⌘S while one is in flight would hold a second copy of a file of
  // tens of megabytes, and race the first to the same path.
  const running = writing.get(assetId)
  if (running) return running

  const done = write(bridge, assetId, state, skins)
  writing.set(assetId, done)

  try {
    return await done
  } finally {
    writing.delete(assetId)
  }
}

const writing = new Map<string, Promise<boolean>>()

/** The port, kept: its worker drags all of three.js, and a ⌘S paid for that parse every time. */
let writer: GlbWriter | null = null

async function write(
  bridge: StudioBridge,
  assetId: string,
  state: CharacterState,
  skins: CharacterSkinning,
): Promise<boolean> {
  const file = new Uint8Array(await (await fetchAsset(assetId)).arrayBuffer())
  writer ??= createGlbWriter(() => new GlbWriteWorker())

  const written = await writer.write(file, {
    bones: state.rig?.bones ?? [],
    skins,
    extras: extrasOf(state),
  })
  if (!written) return false

  await bridge.assets.saveMesh({ replaces: assetId, glb: written })

  const saved = characterStore.use.getState()
  saved.markSaved(assetId, characterStore.markOf(saved, assetId))
  return true
}

/** What glTF has no place for: a corrected role, a point of attachment, a motion this one plays. */
export function extrasOf(state: CharacterState): CharacterExtras {
  const roles = Object.fromEntries(
    (state.rig?.bones ?? []).flatMap(bone => (bone.role ? [[bone.name, bone.role]] : [])),
  )

  return {
    ...(Object.keys(roles).length > 0 && { roles }),
    ...(state.sockets.length > 0 && { sockets: state.sockets }),
    ...(state.motions.length > 0 && { motions: state.motions }),
  }
}
