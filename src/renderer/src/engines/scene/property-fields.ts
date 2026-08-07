import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Vector3,
} from '@shared/domain/scene'

/*
 * What each field of a descriptor is, so the inspector can be derived from a descriptor rather
 * than written per shape. Same rule as the generation forms: a hand-written panel for `box` is
 * a bug, not a shortcut — CLAUDE.md, invariant 5.
 *
 * The tables are mapped over the descriptor unions, so a primitive added without a spec for
 * every one of its parameters fails to compile.
 */

export type PropertySpec =
  | { control: 'number'; min?: number; max?: number; step: number }
  /** A value with both ends: how far along its range it sits is what the user is judging. */
  | { control: 'slider'; min: number; max: number; step: number }
  | { control: 'color' }
  | { control: 'vector3'; step: number }

export type FieldValue = number | string | Vector3

export type PropertyField = {
  name: string
  value: FieldValue
  /** Absent for a field no table describes — it still renders, bare. */
  spec?: PropertySpec
}

type SpecsOf<D extends { kind: string }> = {
  [K in D['kind']]: {
    [F in Exclude<keyof Extract<D, { kind: K }>, 'kind'>]: PropertySpec
  }
}

/** A size in scene units. Never zero: a degenerate primitive is a mesh that vanishes. */
const SIZE: PropertySpec = { control: 'number', min: 0.001, step: 0.1 }
/** Segments around an axis. Below three there is no surface left to shade. */
const RING_SEGMENTS: PropertySpec = { control: 'number', min: 3, max: 128, step: 1 }
const SEGMENTS: PropertySpec = { control: 'number', min: 1, max: 128, step: 1 }
const WINDING: PropertySpec = { control: 'number', min: 1, max: 20, step: 1 }

const GEOMETRY_SPECS: SpecsOf<GeometryDescriptor> = {
  box: { width: SIZE, height: SIZE, depth: SIZE },
  capsule: {
    radius: SIZE,
    height: SIZE,
    capSegments: SEGMENTS,
    radialSegments: RING_SEGMENTS,
  },
  circle: { radius: SIZE, segments: RING_SEGMENTS },
  cylinder: {
    // Zero is legal here, and is what makes a cone out of a cylinder.
    radiusTop: { control: 'number', min: 0, step: 0.1 },
    radiusBottom: { control: 'number', min: 0, step: 0.1 },
    height: SIZE,
    segments: RING_SEGMENTS,
  },
  dodecahedron: { radius: SIZE },
  icosahedron: { radius: SIZE },
  lathe: { segments: RING_SEGMENTS },
  octahedron: { radius: SIZE },
  plane: { width: SIZE, height: SIZE },
  ring: {
    innerRadius: { control: 'number', min: 0, step: 0.1 },
    outerRadius: SIZE,
    segments: RING_SEGMENTS,
  },
  sphere: { radius: SIZE, widthSegments: RING_SEGMENTS, heightSegments: SEGMENTS },
  tetrahedron: { radius: SIZE },
  torus: {
    radius: SIZE,
    tube: SIZE,
    radialSegments: SEGMENTS,
    tubularSegments: RING_SEGMENTS,
  },
  torusKnot: {
    radius: SIZE,
    tube: SIZE,
    tubularSegments: RING_SEGMENTS,
    radialSegments: SEGMENTS,
    p: WINDING,
    q: WINDING,
  },
  tube: { radius: SIZE, tubularSegments: RING_SEGMENTS, radialSegments: SEGMENTS },
}

const COLOR: PropertySpec = { control: 'color' }
/** Bounded so the slider stays usable; the field beside it still takes anything typed. */
const INTENSITY: PropertySpec = { control: 'slider', min: 0, max: 10, step: 0.1 }
/** Zero means no falloff at all — three.js reads it as "reaches everywhere". */
const RANGE: PropertySpec = { control: 'number', min: 0, step: 0.5 }
const DECAY: PropertySpec = { control: 'number', min: 0, max: 4, step: 0.1 }
const TARGET: PropertySpec = { control: 'vector3', step: 0.1 }

const LIGHT_SPECS: SpecsOf<LightDescriptor> = {
  ambient: { color: COLOR, intensity: INTENSITY },
  directional: { color: COLOR, intensity: INTENSITY, target: TARGET },
  hemisphere: { skyColor: COLOR, groundColor: COLOR, intensity: INTENSITY },
  point: { color: COLOR, intensity: INTENSITY, distance: RANGE, decay: DECAY },
  spot: {
    color: COLOR,
    intensity: INTENSITY,
    distance: RANGE,
    // Half-angle of the cone, in radians: a spot wider than a hemisphere lights nothing more.
    angle: { control: 'slider', min: 0.01, max: Math.PI / 2, step: 0.01 },
    penumbra: { control: 'slider', min: 0, max: 1, step: 0.01 },
    decay: DECAY,
    target: TARGET,
  },
}

const UNIT: PropertySpec = { control: 'slider', min: 0, max: 1, step: 0.01 }

const MATERIAL_SPECS: Record<string, PropertySpec> = {
  color: COLOR,
  roughness: UNIT,
  metalness: UNIT,
}

export function geometryFields(descriptor: GeometryDescriptor): PropertyField[] {
  return listFields(descriptor, GEOMETRY_SPECS[descriptor.kind])
}

export function lightFields(descriptor: LightDescriptor): PropertyField[] {
  return listFields(descriptor, LIGHT_SPECS[descriptor.kind])
}

/**
 * `fallbackColor` stands in for the `null` that means "the studio's own colour": a swatch has
 * to show something, and the value it shows is the one the viewport is already painting.
 */
export function materialFields(
  descriptor: MaterialDescriptor,
  fallbackColor: string,
): PropertyField[] {
  return listFields({ ...descriptor, color: descriptor.color ?? fallbackColor }, MATERIAL_SPECS)
}

/**
 * A descriptor with one field replaced. The name and the value come from `listFields`, which
 * read them off this very descriptor — so what comes back is the same shape with one number
 * moved, and `withField` is the only place that has to be trusted about it.
 */
export function withField<D extends object>(descriptor: D, name: string, value: FieldValue): D {
  // `as`: a computed key widens the spread to an index signature, which no longer matches the
  // discriminated union — the name is one of `descriptor`'s own keys, so the shape is unchanged.
  return { ...descriptor, [name]: value } as D
}

/**
 * A descriptor read as a list of fields. Nothing is keyed by shape: the names come from the
 * descriptor itself, so a parameter the tables have never heard of is still listed — bare, but
 * listed. A panel that hides what it cannot describe is worse than one that shows it plainly.
 */
function listFields(descriptor: object, specs: Record<string, PropertySpec>): PropertyField[] {
  const fields: PropertyField[] = []

  for (const [name, value] of Object.entries(descriptor)) {
    if (name === 'kind') continue
    if (isFieldValue(value)) fields.push({ name, value, spec: specs[name] })
  }

  return fields
}

function isFieldValue(value: unknown): value is FieldValue {
  return typeof value === 'number' || typeof value === 'string' || isVector3(value)
}

export function isVector3(value: unknown): value is Vector3 {
  if (typeof value !== 'object' || value === null) return false
  return ['x', 'y', 'z'].every(axis => typeof Reflect.get(value, axis) === 'number')
}
