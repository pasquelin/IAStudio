/**
 * Which asset each shipped working texture became in the open project, and the material a new
 * primitive is therefore born with.
 *
 * Module state rather than a store, for one reason: `createNodeOf` is synchronous — it runs
 * inside a command, between two entries of the history — and copying four files into a project
 * is not. The install happens once when a scene space mounts (`useCheckerTextures`), and by the
 * time a hand reaches the Add menu the ids are here.
 *
 * Empty is a legitimate state, not a failure: a project whose textures were deleted, or an
 * install still in flight, gives a plain coloured primitive rather than a dead texture.
 */
import {
  DEFAULT_CHECKER_TEXTURE,
  type CheckerTextureId,
  type InstalledCheckerTexture,
} from '@shared/domain/checkerTexture'
import type { MaterialDescriptor, TextureRef } from '@shared/domain/scene'
import { DEFAULT_MATERIAL } from './sceneState'

const installed = new Map<CheckerTextureId, string>()

/** Replaces what is known, so leaving a project cannot leave its ids behind for the next one. */
export function rememberCheckerTextures(textures: readonly InstalledCheckerTexture[]): void {
  installed.clear()
  for (const texture of textures) installed.set(texture.id, texture.assetId)
}

export function forgetCheckerTextures(): void {
  installed.clear()
}

export function checkerTextureRef(id: CheckerTextureId): TextureRef | null {
  const assetId = installed.get(id)
  return assetId ? { assetId } : null
}

/**
 * What a mesh is born wearing: the checker when the project holds it, the plain material
 * otherwise. The one door — `createNodeOf` and the templates both come through here, so a
 * primitive added by hand and one a template placed cannot disagree about it.
 */
export function defaultMeshMaterial(
  id: CheckerTextureId = DEFAULT_CHECKER_TEXTURE,
): MaterialDescriptor {
  const map = checkerTextureRef(id)
  return map ? { ...DEFAULT_MATERIAL, map } : DEFAULT_MATERIAL
}
