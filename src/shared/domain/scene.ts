/**
 * What a scene can be made of, shared by both processes. Like `domain/tool.ts`, it sits here
 * because the native menu needs the list and `shared/` cannot import from the renderer: the
 * registries live in `engines/`, which the main process must never reach into.
 *
 * Only the kind and its label. The renderer enriches each entry with an icon and a descriptor
 * builder — the two halves the menu has no use for.
 */
export type MeshKind =
  | 'box'
  | 'capsule'
  | 'circle'
  | 'cylinder'
  | 'dodecahedron'
  | 'icosahedron'
  | 'lathe'
  | 'octahedron'
  | 'plane'
  | 'ring'
  | 'sphere'
  | 'sprite'
  | 'tetrahedron'
  | 'text'
  | 'torus'
  | 'torusKnot'
  | 'tube'

export type LightKind = 'ambient' | 'directional' | 'hemisphere' | 'point' | 'spot'

export type SceneEntry<K> = {
  kind: K
  /** i18n key of the label — never the displayed text. */
  labelKey: string
  /** Declared but not buildable yet: shown greyed, so no menu hides what is coming. */
  disabled?: boolean
}

/**
 * Order taken from `three.js/editor/js/Menubar.Add.js`, which is alphabetical in English and
 * kept that way: a stable order across languages beats a sort that moves entries when the
 * language changes.
 */
export const MESH_ENTRIES: readonly SceneEntry<MeshKind>[] = [
  { kind: 'box', labelKey: 'meshes.box' },
  { kind: 'capsule', labelKey: 'meshes.capsule' },
  { kind: 'circle', labelKey: 'meshes.circle' },
  { kind: 'cylinder', labelKey: 'meshes.cylinder' },
  { kind: 'dodecahedron', labelKey: 'meshes.dodecahedron' },
  { kind: 'icosahedron', labelKey: 'meshes.icosahedron' },
  { kind: 'lathe', labelKey: 'meshes.lathe' },
  { kind: 'octahedron', labelKey: 'meshes.octahedron' },
  { kind: 'plane', labelKey: 'meshes.plane' },
  { kind: 'ring', labelKey: 'meshes.ring' },
  { kind: 'sphere', labelKey: 'meshes.sphere' },
  { kind: 'sprite', labelKey: 'meshes.sprite', disabled: true },
  { kind: 'tetrahedron', labelKey: 'meshes.tetrahedron' },
  { kind: 'text', labelKey: 'meshes.text', disabled: true },
  { kind: 'torus', labelKey: 'meshes.torus' },
  { kind: 'torusKnot', labelKey: 'meshes.torusKnot' },
  { kind: 'tube', labelKey: 'meshes.tube' },
]

export const LIGHT_ENTRIES: readonly SceneEntry<LightKind>[] = [
  { kind: 'ambient', labelKey: 'lights.ambient' },
  { kind: 'directional', labelKey: 'lights.directional' },
  { kind: 'hemisphere', labelKey: 'lights.hemisphere' },
  { kind: 'point', labelKey: 'lights.point' },
  { kind: 'spot', labelKey: 'lights.spot' },
]
