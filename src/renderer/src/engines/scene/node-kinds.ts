import { mdiCubeScan, mdiLightbulbOutline, mdiShapeOutline } from '@mdi/js'
import { LIGHT_TYPES } from './light-types'
import { MESH_PRIMITIVES } from './mesh-primitives'
import type { SceneNodeType } from './scene-state'

/** What an add menu needs of a registry entry — the two registries agree on exactly this. */
export type AddEntry = {
  kind: string
  icon: string
  disabled?: boolean
}

export type NodeKind = {
  icon: string
  entries: readonly AddEntry[]
  /** i18n namespace. Both halves declare the same leaves, so every key is derived from it. */
  namespace: string
}

/**
 * The kinds a panel is built for. A model is not one: it has no Add menu — it arrives from the
 * project's assets — no panel of its own, and therefore no empty state to name. Everything here
 * is read by a panel, its title bar and its flyout, which is exactly what a model has none of.
 */
export type PanelNodeType = Exclude<SceneNodeType, 'model'>

/**
 * What tells a mesh from a light, everywhere: the rail icon, the panels, the toolbar's Add
 * flyout and the empty states all read this.
 */
export const NODE_KINDS: Record<PanelNodeType, NodeKind> = {
  mesh: { icon: mdiShapeOutline, entries: MESH_PRIMITIVES, namespace: 'meshes' },
  light: { icon: mdiLightbulbOutline, entries: LIGHT_TYPES, namespace: 'lights' },
}

/** The glyph of an imported model. It has no registry, so it has no entry to carry one. */
export const MODEL_ICON = mdiCubeScan

/** i18n key of what a kind is called. */
export function labelKeyOf(kind: NodeKind, entry: AddEntry): string {
  return `${kind.namespace}.${entry.kind}`
}

/** Everything a scene can hold, meshes then lights, in the order the registries declare. */
export const ADD_ENTRIES: readonly { entry: AddEntry; labelKey: string }[] = Object.values(
  NODE_KINDS,
).flatMap(kind => kind.entries.map(entry => ({ entry, labelKey: labelKeyOf(kind, entry) })))
