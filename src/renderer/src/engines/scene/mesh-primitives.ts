import {
  mdiCircleDouble,
  mdiCircleOutline,
  mdiCube,
  mdiCylinder,
  mdiFormatText,
  mdiHexagonOutline,
  mdiImageOutline,
  mdiInfinity,
  mdiOctahedron,
  mdiPill,
  mdiPillar,
  mdiPipe,
  mdiPyramid,
  mdiRing,
  mdiSoccer,
  mdiSphere,
  mdiSquareOutline,
} from '@mdi/js'
import type { GeometryDescriptor } from './scene-state'

export type MeshPrimitive = {
  kind: GeometryDescriptor['kind'] | 'sprite' | 'text'
  labelKey: string
  icon: string
  /** Absent while the primitive is not buildable yet: the menu greys it rather than hiding it. */
  create?: () => GeometryDescriptor
}

/**
 * The primitives of `three.js/editor/js/Menubar.Add.js`, in its order — alphabetical in English,
 * and kept that way so entries do not move when the language changes.
 *
 * Segment counts sit below the official editor's: a 32 x 16 sphere is already smooth on screen,
 * and every extra ring is paid on every frame.
 */
export const MESH_PRIMITIVES: readonly MeshPrimitive[] = [
  {
    kind: 'box',
    labelKey: 'meshes.box',
    icon: mdiCube,
    create: () => ({ kind: 'box', width: 1, height: 1, depth: 1 }),
  },
  {
    kind: 'capsule',
    labelKey: 'meshes.capsule',
    icon: mdiPill,
    create: () => ({ kind: 'capsule', radius: 0.5, height: 1, capSegments: 8, radialSegments: 16 }),
  },
  {
    kind: 'circle',
    labelKey: 'meshes.circle',
    icon: mdiCircleOutline,
    create: () => ({ kind: 'circle', radius: 0.5, segments: 32 }),
  },
  {
    kind: 'cylinder',
    labelKey: 'meshes.cylinder',
    icon: mdiCylinder,
    create: () => ({
      kind: 'cylinder',
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      segments: 32,
    }),
  },
  {
    kind: 'dodecahedron',
    labelKey: 'meshes.dodecahedron',
    icon: mdiHexagonOutline,
    create: () => ({ kind: 'dodecahedron', radius: 0.5 }),
  },
  {
    // A football is a truncated icosahedron, which is as close as an icon library gets.
    kind: 'icosahedron',
    labelKey: 'meshes.icosahedron',
    icon: mdiSoccer,
    create: () => ({ kind: 'icosahedron', radius: 0.5 }),
  },
  {
    // A column is the piece a lathe turns, and there is no lathe glyph.
    kind: 'lathe',
    labelKey: 'meshes.lathe',
    icon: mdiPillar,
    create: () => ({ kind: 'lathe', segments: 12 }),
  },
  {
    kind: 'octahedron',
    labelKey: 'meshes.octahedron',
    icon: mdiOctahedron,
    create: () => ({ kind: 'octahedron', radius: 0.5 }),
  },
  {
    kind: 'plane',
    labelKey: 'meshes.plane',
    icon: mdiSquareOutline,
    create: () => ({ kind: 'plane', width: 1, height: 1 }),
  },
  {
    kind: 'ring',
    labelKey: 'meshes.ring',
    icon: mdiRing,
    create: () => ({ kind: 'ring', innerRadius: 0.25, outerRadius: 0.5, segments: 32 }),
  },
  {
    kind: 'sphere',
    labelKey: 'meshes.sphere',
    icon: mdiSphere,
    create: () => ({ kind: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 16 }),
  },
  {
    // Not a geometry but a camera-facing image, hence no `create` yet.
    kind: 'sprite',
    labelKey: 'meshes.sprite',
    icon: mdiImageOutline,
  },
  {
    // A tetrahedron is a triangular pyramid.
    kind: 'tetrahedron',
    labelKey: 'meshes.tetrahedron',
    icon: mdiPyramid,
    create: () => ({ kind: 'tetrahedron', radius: 0.5 }),
  },
  {
    // `TextGeometry` needs a JSON font loaded, so it needs an asset and a loader first.
    kind: 'text',
    labelKey: 'meshes.text',
    icon: mdiFormatText,
  },
  {
    kind: 'torus',
    labelKey: 'meshes.torus',
    icon: mdiCircleDouble,
    create: () => ({
      kind: 'torus',
      radius: 0.5,
      tube: 0.2,
      radialSegments: 16,
      tubularSegments: 32,
    }),
  },
  {
    kind: 'torusKnot',
    labelKey: 'meshes.torusKnot',
    icon: mdiInfinity,
    create: () => ({
      kind: 'torusKnot',
      radius: 0.5,
      tube: 0.2,
      tubularSegments: 64,
      radialSegments: 8,
      p: 2,
      q: 3,
    }),
  },
  {
    kind: 'tube',
    labelKey: 'meshes.tube',
    icon: mdiPipe,
    create: () => ({ kind: 'tube', radius: 0.1, tubularSegments: 64, radialSegments: 8 }),
  },
]

export function primitiveByKind(kind: string): MeshPrimitive | null {
  return MESH_PRIMITIVES.find(primitive => primitive.kind === kind) ?? null
}
