import type { CharacterExtras } from '@shared/domain/character'
import type { GlbSkinPatch } from '@/engines/scene/glbSkin'
import type { CharacterState } from '@/engines/character/characterState'
import { createGlbWriter, type GlbWriter } from '@/engines/scene/glbWriter'
import type { StudioBridge } from '@shared/ipc'
import { assetBytes } from '@/helpers/assetFetch'
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
  if (!bridge) return false

  // 🛑 One save at a time, but never a save SKIPPED: a second ⌘S while one is in flight used to
  // be answered with the first one's promise, so it wrote nothing and still said `true` — asked
  // again precisely because the first showed nothing. It waits its turn instead.
  const done = afterward(writing.get(assetId), () => write(bridge, assetId, skins))
  writing.set(assetId, done)

  try {
    return await done
  } finally {
    // Only if nothing queued behind it, or the next ⌘S would run beside this one after all.
    if (writing.get(assetId) === done) writing.delete(assetId)
  }
}

const writing = new Map<string, Promise<boolean>>()

/** Held back until the write already in flight has landed — never beside it. */
async function afterward(
  running: Promise<boolean> | undefined,
  next: () => Promise<boolean>,
): Promise<boolean> {
  try {
    await running
  } catch {
    // The write before this one reported its own failure; this one still owes its own answer.
  }

  return next()
}

/** The port, kept: its worker drags all of three.js, and a ⌘S paid for that parse every time. */
let writer: GlbWriter | null = null

async function write(
  bridge: StudioBridge,
  assetId: string,
  skins: CharacterSkinning,
): Promise<boolean> {
  // Read as the write STARTS and not when ⌘S was pressed: one held back behind another would
  // otherwise write the skeleton as it stood before the wait, over the one now on screen.
  const current = characterStore.use.getState()
  const state = characterOf(current, assetId)
  if (!state.rig) return false

  // 🛑 The mark BEFORE the write, handed back after it — `documentStore.markSaved` spells the
  // rule and `documentIo` follows it: rebuilding tens of megabytes takes seconds, and a joint
  // dragged during them is in no file. Read afterwards, it was counted as saved all the same.
  const mark = characterStore.markOf(current, assetId)
  const file = await assetBytes(assetId)
  writer ??= createGlbWriter(() => new GlbWriteWorker())

  const written = await writer.write(file, {
    bones: state.rig.bones,
    skins,
    extras: extrasOf(state),
  })
  if (!written) return false

  await bridge.assets.saveMesh({ replaces: assetId, glb: written })

  characterStore.use.getState().markSaved(assetId, mark)
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
