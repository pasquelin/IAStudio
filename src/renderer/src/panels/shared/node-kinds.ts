import { mdiLightbulbOutline, mdiShapeOutline } from '@mdi/js'
import { LIGHT_TYPES } from '@/engines/scene/light-types'
import { MESH_PRIMITIVES } from '@/engines/scene/mesh-primitives'
import type { SceneNodeType } from '@/engines/scene/scene-state'

/** What an add menu needs of a registry entry — the two registries agree on exactly this. */
export type AddEntry = {
  kind: string
  labelKey: string
  icon: string
  disabled?: boolean
}

export type NodeKind = {
  icon: string
  /** What the panel's add menu offers. */
  entries: readonly AddEntry[]
  /** i18n namespace. Both halves declare the same leaves, so every key is derived from it. */
  namespace: string
}

/**
 * What tells the mesh panel from the light panel — everything else about them is the same, and
 * a third kind of node is a row here rather than a third pair of near-identical files.
 */
export const NODE_KINDS: Record<SceneNodeType, NodeKind> = {
  mesh: { icon: mdiShapeOutline, entries: MESH_PRIMITIVES, namespace: 'meshes' },
  light: { icon: mdiLightbulbOutline, entries: LIGHT_TYPES, namespace: 'lights' },
}
