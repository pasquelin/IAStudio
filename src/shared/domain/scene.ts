/**
 * What a scene is made of, shared by both processes. Like `domain/tool.ts`, it sits here
 * because the native menu needs the list and `shared/` cannot import from the renderer.
 *
 * The descriptors live here too, and not in `engines/`: they are the serialized form of a
 * document, which is what `shared/domain` is for — and it is what lets `MeshKind` be *derived*
 * from them instead of restated, so a geometry added without a menu entry fails to compile.
 */
export type Vector3 = { x: number; y: number; z: number }

export type Transform = {
  position: Vector3
  /** Euler angles, in radians. */
  rotation: Vector3
  scale: Vector3
}

/**
 * Each primitive carries its own parameters rather than a shared bag of optionals: a sphere has
 * no depth, and a type that lets it have one stops describing anything.
 */
export type GeometryDescriptor =
  | { kind: 'box'; width: number; height: number; depth: number }
  | { kind: 'capsule'; radius: number; height: number; capSegments: number; radialSegments: number }
  | { kind: 'circle'; radius: number; segments: number }
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number }
  | { kind: 'dodecahedron'; radius: number }
  | { kind: 'icosahedron'; radius: number }
  | { kind: 'lathe'; segments: number }
  | { kind: 'octahedron'; radius: number }
  | { kind: 'plane'; width: number; height: number }
  | { kind: 'ring'; innerRadius: number; outerRadius: number; segments: number }
  | { kind: 'sphere'; radius: number; widthSegments: number; heightSegments: number }
  | { kind: 'tetrahedron'; radius: number }
  | { kind: 'torus'; radius: number; tube: number; radialSegments: number; tubularSegments: number }
  | {
      kind: 'torusKnot'
      radius: number
      tube: number
      tubularSegments: number
      radialSegments: number
      p: number
      q: number
    }
  | { kind: 'tube'; radius: number; tubularSegments: number; radialSegments: number }

export type MaterialDescriptor = {
  kind: 'standard'
  /** `null` means the studio's own colour, resolved from the palette when the mesh is built. */
  color: string | null
  roughness: number
  metalness: number
}

/**
 * `target` is a point, not an object. three.js aims a light at an `Object3D`, and the official
 * editor shows that object in its outliner — but a node that cannot be renamed, hidden or
 * deleted is a property that leaked into the tree, and it doubles the length of a lit scene.
 */
export type LightDescriptor =
  | { kind: 'ambient'; color: string; intensity: number }
  | { kind: 'directional'; color: string; intensity: number; target: Vector3 }
  | { kind: 'hemisphere'; skyColor: string; groundColor: string; intensity: number }
  | { kind: 'point'; color: string; intensity: number; distance: number; decay: number }
  | {
      kind: 'spot'
      color: string
      intensity: number
      distance: number
      angle: number
      penumbra: number
      decay: number
      target: Vector3
    }

/** `sprite` and `text` are offered but not buildable yet: neither is a geometry. */
export type MeshKind = GeometryDescriptor['kind'] | 'sprite' | 'text'

export type LightKind = LightDescriptor['kind']

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
