import { isRecord } from '../guards'

/**
 * The domain key studio data travels under, in the `extras` of the SCENE — not of the document.
 * A scene's extras are what three carries in `Scene.userData`, so they survive a trip through a
 * loader and an exporter, where a field on the root would not.
 */
export const GLTF_STUDIO_KEY = 'scenario'

/** Which document of the studio this file IS. Written by the window, read by the file layer. */
export const GLTF_DOCUMENT_ID = 'documentId'

/**
 * Which kind of document it is, the 3D scene and the sky sharing this container — so the name
 * cannot say, and only this can.
 */
export const GLTF_DOCUMENT_KIND = 'documentKind'

/** What the studio holds that the standard has no field for, under the key above. */
export const GLTF_SCENE_STATE = 'scene'

/** A glTF 2.0 document, told from the studio's own envelope under the same extension. */
export function isGltfDocument(value: unknown): value is Record<string, unknown> {
  const asset = isRecord(value) ? value.asset : null
  return isRecord(asset) && typeof asset.version === 'string'
}

/**
 * What rides under the studio's own domain, or nothing.
 *
 * Read off the DEFAULT scene, the one `scene` names — a document holding several would otherwise
 * answer for whichever happened to be written first.
 */
export function gltfStudioMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}

  const scenes = value.scenes
  const at = typeof value.scene === 'number' ? value.scene : 0
  const scene = Array.isArray(scenes) ? scenes[at] : undefined
  const extras = isRecord(scene) ? scene.extras : undefined
  const studio = isRecord(extras) ? extras[GLTF_STUDIO_KEY] : undefined
  return isRecord(studio) ? studio : {}
}

/**
 * Which textures a glTF material definition asks to wear.
 *
 * Shared because both sides read the same rule from the same files, and a rule spelt twice is
 * two rules the day one is edited: the window compares what a parse produced against what the
 * materials wanted, and the main process takes those very pictures out into the project.
 *
 * Matched by SHAPE rather than against a list of five names: glTF spells every texture slot
 * `…Texture: { index }`, whichever specification added it, so an extension's map is found
 * without this module ever hearing of the extension.
 *
 * A definition is read as data and never trusted for a shape — it comes from a file, and
 * `parser.json` is typed `any` by three.
 */
export function textureSlotsOf(
  materialDef: unknown,
  into: { slot: string; index: number }[] = [],
): { slot: string; index: number }[] {
  if (!isRecord(materialDef)) return into

  for (const [key, value] of Object.entries(materialDef)) {
    if (!isRecord(value)) continue

    if (key.endsWith('Texture') && typeof value.index === 'number') {
      into.push({ slot: key, index: value.index })
    } else textureSlotsOf(value, into)
  }

  return into
}

/** The `materials[index]` of a glTF document, or nothing when the document has no such thing. */
export function materialDefOf(json: unknown, index: number): unknown {
  const materials = isRecord(json) ? json.materials : undefined
  return Array.isArray(materials) ? materials[index] : undefined
}
