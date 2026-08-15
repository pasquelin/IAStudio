import { isRecord } from '../guards'

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
