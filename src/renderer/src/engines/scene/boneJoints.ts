/**
 * The joints of a skeleton, drawn as points.
 *
 * `SkeletonHelper` draws the bones as SEGMENTS and nothing else, so a joint — which is what one
 * actually clicks and drags — had no mark of its own: a chain of three bones read as two lines
 * meeting somewhere, and the somewhere is the thing being aimed at.
 *
 * Points rather than little spheres: a sphere is a mesh per joint, lit, sorted and depth-tested,
 * where fifty-two joints have to cost one draw call and stay the same size however far the
 * camera is.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  Vector3,
  type Bone,
} from 'three'
import { rootColour } from '../core/palette'

/** Screen pixels, never metres: the mark has to stay aimable whatever the camera is doing. */
const JOINT_SIZE = 7

const WORLD = new Vector3()

export type BoneJoints = {
  points: Points
  /** Reads every bone's world position again — they move with the pose, every frame. */
  refresh: () => void
  dispose: () => void
}

/**
 * One point per bone, in WORLD space and hung beside the scene rather than inside it.
 *
 * Inside, the outliner would list it and a click could pick it; beside, it is decoration exactly
 * as the helper it doubles is.
 */
export function createBoneJoints(bones: readonly Bone[]): BoneJoints {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(bones.length * 3)
  const attribute = new BufferAttribute(positions, 3)
  geometry.setAttribute('position', attribute)

  const material = new PointsMaterial({
    color: new Color(rootColour('--color-accent')),
    size: JOINT_SIZE,
    // Screen-sized, and drawn THROUGH the mesh: a joint inside a body is exactly the one a user
    // is looking for, and one that disappears under a shoulder cannot be aimed at.
    sizeAttenuation: false,
    depthTest: false,
    transparent: true,
  })

  const points = new Points(geometry, material)
  // Off the raycaster, like the helper: a click has to land on the model, and bone picking runs
  // off the projected bones rather than off anything drawn.
  points.raycast = () => {}
  // Drawn after everything, so a joint is never hidden by what it sits in.
  points.renderOrder = 1
  points.frustumCulled = false

  const refresh = (): void => {
    for (const [index, bone] of bones.entries()) {
      bone.getWorldPosition(WORLD)
      positions[index * 3] = WORLD.x
      positions[index * 3 + 1] = WORLD.y
      positions[index * 3 + 2] = WORLD.z
    }
    attribute.needsUpdate = true
  }

  refresh()

  return {
    points,
    refresh,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
