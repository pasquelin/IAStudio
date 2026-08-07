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
import { MESH_ENTRIES, type GeometryDescriptor, type MeshKind } from '@shared/domain/scene'

export type MeshPrimitive = {
  kind: MeshKind
  labelKey: string
  icon: string
  /** Declared but not buildable yet: every menu greys it rather than hiding it. */
  disabled: boolean
  create?: () => GeometryDescriptor
}

/**
 * What the shared table cannot carry: the glyph and the descriptor.
 *
 * `create` is narrowed per kind, so a builder handed the wrong descriptor fails to compile —
 * and `sprite` and `text`, which no geometry answers, can only be declared without one.
 *
 * Segment counts sit below the official editor's: a 32 x 16 sphere is already smooth on screen,
 * and every extra ring is paid on every frame.
 */
type MeshBuilders = {
  [K in MeshKind]: {
    icon: string
    create?: () => Extract<GeometryDescriptor, { kind: K }>
  }
}

const MESH_BUILDERS: MeshBuilders = {
  box: {
    icon: mdiCube,
    create: () => ({ kind: 'box', width: 1, height: 1, depth: 1 }),
  },
  capsule: {
    icon: mdiPill,
    create: () => ({ kind: 'capsule', radius: 0.5, height: 1, capSegments: 8, radialSegments: 16 }),
  },
  circle: {
    icon: mdiCircleOutline,
    create: () => ({ kind: 'circle', radius: 0.5, segments: 32 }),
  },
  cylinder: {
    icon: mdiCylinder,
    create: () => ({
      kind: 'cylinder',
      radiusTop: 0.5,
      radiusBottom: 0.5,
      height: 1,
      segments: 32,
    }),
  },
  dodecahedron: {
    icon: mdiHexagonOutline,
    create: () => ({ kind: 'dodecahedron', radius: 0.5 }),
  },
  // A football is a truncated icosahedron, which is as close as an icon library gets.
  icosahedron: {
    icon: mdiSoccer,
    create: () => ({ kind: 'icosahedron', radius: 0.5 }),
  },
  // A column is the piece a lathe turns, and there is no lathe glyph.
  lathe: {
    icon: mdiPillar,
    create: () => ({ kind: 'lathe', segments: 12 }),
  },
  octahedron: {
    icon: mdiOctahedron,
    create: () => ({ kind: 'octahedron', radius: 0.5 }),
  },
  plane: {
    icon: mdiSquareOutline,
    create: () => ({ kind: 'plane', width: 1, height: 1 }),
  },
  ring: {
    icon: mdiRing,
    create: () => ({ kind: 'ring', innerRadius: 0.25, outerRadius: 0.5, segments: 32 }),
  },
  sphere: {
    icon: mdiSphere,
    create: () => ({ kind: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 16 }),
  },
  // Not a geometry but a camera-facing image, hence no builder.
  sprite: { icon: mdiImageOutline },
  // A tetrahedron is a triangular pyramid.
  tetrahedron: {
    icon: mdiPyramid,
    create: () => ({ kind: 'tetrahedron', radius: 0.5 }),
  },
  // `TextGeometry` needs a JSON font loaded, so it needs an asset and a loader first.
  text: { icon: mdiFormatText },
  torus: {
    icon: mdiCircleDouble,
    create: () => ({
      kind: 'torus',
      radius: 0.5,
      tube: 0.2,
      radialSegments: 16,
      tubularSegments: 32,
    }),
  },
  torusKnot: {
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
  tube: {
    icon: mdiPipe,
    create: () => ({ kind: 'tube', radius: 0.1, tubularSegments: 64, radialSegments: 8 }),
  },
}

/** The shared table, in its order, with the glyph and the builder the menu has no use for. */
export const MESH_PRIMITIVES: readonly MeshPrimitive[] = MESH_ENTRIES.map(entry => ({
  kind: entry.kind,
  labelKey: entry.labelKey,
  // One answer to "is this offered yet", derived rather than declared twice: the native menu
  // reads the shared flag and the in-app menus read this, and they must never disagree.
  disabled: entry.disabled ?? MESH_BUILDERS[entry.kind].create === undefined,
  ...MESH_BUILDERS[entry.kind],
}))

// Indexed: the panels look a kind up per visible row per render, and a linear scan over
// seventeen entries inside a virtualized list is paid on every frame of a drag.
const BY_KIND: ReadonlyMap<string, MeshPrimitive> = new Map(
  MESH_PRIMITIVES.map(primitive => [primitive.kind, primitive]),
)

export function primitiveByKind(kind: string): MeshPrimitive | null {
  return BY_KIND.get(kind) ?? null
}
