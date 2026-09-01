/**
 * The bones of a skeleton drawn as SOLIDS, the way every 3D editor draws them.
 *
 * A line between two joints says where a bone runs and nothing about which way it faces, so a
 * rotation had no landmark at all: the gizmo turned and the skeleton looked identical. An
 * octahedron — wide near its head, tapering to its tail — reads as a direction at a glance, and
 * its four faces catch the light differently as it turns.
 *
 * Rebuilt into ONE geometry rather than a mesh per bone: fifty-two meshes are fifty-two draw
 * calls and fifty-two matrices to update every frame the pose moves.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Bone,
  type Object3D,
} from 'three'
import { rootColour } from '../core/palette'

/** Triangles per bone: four from the head to the waist, four from the waist to the tail. */
const FACES = 8

/** How far along the bone its widest ring sits, and how wide that ring is, as fractions. */
const WAIST_ALONG = 0.12
const WAIST_WIDE = 0.1

/** What a bone with no child is drawn as, as a fraction of its parent's length. */
const LEAF = 0.35

/** The two colours a bone takes. Handed in for `createBoneJoints`' reason: a runner resolves none. */
export type BoneColours = { rest: string; picked: string }

const BONE_COLOURS = (): BoneColours => ({
  rest: rootColour('--color-mesh'),
  picked: rootColour('--color-accent'),
})

export type BoneShapes = {
  mesh: Mesh
  /** Reads every bone's world placement again — they move with the pose, every frame. */
  refresh: () => void
  /** Paints one bone as the CHOSEN one, or none. */
  pick: (bone: string | null) => void
  dispose: () => void
}

const HEAD = new Vector3()
const TAIL = new Vector3()
const AXIS = new Vector3()
const SIDE = new Vector3()
const UP = new Vector3()
const RING = new Vector3()

/**
 * One octahedron per bone, in WORLD space and hung beside the scene rather than inside it.
 *
 * Inside, the outliner would list it and a click could pick it; beside, it is decoration exactly
 * as the helper it replaces was.
 */
export function createBoneShapes(
  bones: readonly Bone[],
  readColours: () => BoneColours = BONE_COLOURS,
): BoneShapes {
  const vertices = bones.length * FACES * 3
  const positions = new Float32Array(vertices * 3)
  const colours = new Float32Array(vertices * 3)

  const geometry = new BufferGeometry()
  const position = new BufferAttribute(positions, 3)
  const colour = new BufferAttribute(colours, 3)
  geometry.setAttribute('position', position)
  geometry.setAttribute('color', colour)

  const palette = readColours()
  const restColour = new Color(palette.rest)
  const pickedColour = new Color(palette.picked)

  const material = new MeshBasicMaterial({
    vertexColors: true,
    // Drawn THROUGH the mesh, like the joints: a bone inside a body is exactly the one being
    // aimed at, and one hidden under a shoulder cannot be picked at all.
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  })

  const mesh = new Mesh(geometry, material)
  // Off the raycaster, like the helper it replaces: a click has to land on the model, and bone
  // picking runs off the projected bones rather than off anything drawn.
  mesh.raycast = () => {}
  mesh.renderOrder = 1
  mesh.frustumCulled = false

  const held = new Set<Object3D>(bones)
  const roots = bones.filter(bone => !bone.parent || !held.has(bone.parent))
  const childOf = new Map<Bone, Bone>()
  for (const bone of bones) {
    const parent = bone.parent
    if (parent && held.has(parent) && !childOf.has(parent as Bone))
      childOf.set(parent as Bone, bone)
  }

  const refresh = (): void => {
    for (const root of roots) root.updateWorldMatrix(true, true)

    for (const [index, bone] of bones.entries()) {
      HEAD.setFromMatrixPosition(bone.matrixWorld)
      const child = childOf.get(bone)
      if (child) TAIL.setFromMatrixPosition(child.matrixWorld)
      else leafTail(bone, HEAD, TAIL)

      writeOctahedron(positions, index * FACES * 9, HEAD, TAIL)
    }
    position.needsUpdate = true
  }

  const pick = (picked: string | null): void => {
    for (const [index, bone] of bones.entries()) {
      const paint = bone.name === picked ? pickedColour : restColour
      for (let corner = 0; corner < FACES * 3; corner += 1) {
        const at = (index * FACES * 3 + corner) * 3
        colours[at] = paint.r
        colours[at + 1] = paint.g
        colours[at + 2] = paint.b
      }
    }
    colour.needsUpdate = true
  }

  refresh()
  pick(null)

  return {
    mesh,
    refresh,
    pick,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * Where a bone with no child points, and how far.
 *
 * Along its PARENT's direction: a leaf carries no direction of its own, and drawing it along an
 * arbitrary axis would make a fingertip point somewhere its finger does not.
 */
function leafTail(bone: Bone, head: Vector3, into: Vector3): void {
  const parent = bone.parent
  if (!parent) {
    into.copy(head).addScaledVector(new Vector3(0, 1, 0), LEAF)
    return
  }

  AXIS.setFromMatrixPosition(parent.matrixWorld)
  into.copy(head).sub(AXIS)
  const length = into.length()
  if (length <= 0) into.set(0, LEAF, 0)
  else into.multiplyScalar(LEAF)
  into.add(head)
}

/**
 * Eight triangles: head to waist ring, waist ring to tail. The ring is square and perpendicular
 * to the bone, which is what makes a turn about the bone's own axis visible.
 */
function writeOctahedron(into: Float32Array, at: number, head: Vector3, tail: Vector3): void {
  AXIS.copy(tail).sub(head)
  const length = AXIS.length()
  if (length <= 0) {
    into.fill(0, at, at + FACES * 9)
    return
  }
  AXIS.divideScalar(length)

  // Any vector not along the bone: `UP` is the world's, swapped where the bone runs up it.
  UP.set(0, 1, 0)
  if (Math.abs(AXIS.y) > 0.9) UP.set(1, 0, 0)
  SIDE.copy(UP).cross(AXIS).normalize()
  UP.copy(AXIS).cross(SIDE).normalize()

  const waist = length * WAIST_WIDE
  const ring: Vector3[] = []
  for (const [side, up] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    ring.push(
      RING.copy(head)
        .addScaledVector(AXIS, length * WAIST_ALONG)
        .addScaledVector(SIDE, (side ?? 0) * waist)
        .addScaledVector(UP, (up ?? 0) * waist)
        .clone(),
    )
  }

  let cursor = at
  const write = (point: Vector3): void => {
    into[cursor] = point.x
    into[cursor + 1] = point.y
    into[cursor + 2] = point.z
    cursor += 3
  }

  for (let corner = 0; corner < 4; corner += 1) {
    const one = ring[corner]
    const next = ring[(corner + 1) % 4]
    if (!one || !next) continue

    write(head)
    write(one)
    write(next)

    write(tail)
    write(next)
    write(one)
  }
}
