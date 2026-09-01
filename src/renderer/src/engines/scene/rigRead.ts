import { Euler, Matrix4, Quaternion, Vector3, type Object3D, type SkinnedMesh } from 'three'
import type { Rig, RigBone, RigFault, RigOrigin } from '@shared/domain/rig'
import { rigFaultOf } from '@shared/domain/rig'
import { characterExtrasOf, type CharacterExtras } from '@shared/domain/character'
import type { Transform } from '@shared/domain/transform'
import { skeletonBonesOf } from './rigState'

/**
 * A skeleton a `.glb` already carries, read back as the document spells one.
 *
 * The other half of `rigFit`, and the one the studio never had: a character rigged elsewhere —
 * by Blender, by a service — was a file whose bones nothing here could edit.
 */
export type RigReadFault = 'no-bones' | 'no-named-bone' | RigFault

/** Why this model gives no rig, or nothing. Read before a caller offers to fit one. */
export function rigReadFaultOf(root: Object3D): RigReadFault | null {
  const bones = rigBonesOf(root)
  if (bones.length > 0) return rigFaultOf(bones)

  return skeletonBonesOf(root).length === 0 && !hasBone(root) ? 'no-bones' : 'no-named-bone'
}

/**
 * The bones a loaded model carries, each rest pose in the space of the parent the RIG keeps.
 *
 * 🛑 Never the bone's own `position`/`quaternion`/`scale`: those are local to the true parent, and
 * an unnamed bone or a plain group in between makes that a space `bonesOfRig` will not rebuild.
 *
 * The order is the FILE's, parents before children — not the one a fitter laid its bones in.
 */
export function rigBonesOf(root: Object3D): RigBone[] {
  const places = bindPlacesOf(root)
  const held = new Matrix4()

  return skeletonBonesOf(root).flatMap(bone => {
    const place = places.get(bone.name)
    const above = bone.parent === null ? root.matrixWorld : places.get(bone.parent)
    if (!place || !above) return []

    held.copy(above).invert().multiply(place)
    return [{ ...bone, rest: transformOf(held) }]
  })
}

/**
 * The rig a model already wears, or `null` when it wears none this studio can hold.
 *
 * A role the FILE puts right wins over the one a name spells: correcting « this bone is the left
 * hip » is what makes a foreign skeleton animatable, and glTF has nowhere else to keep it.
 */
export function rigFromObject(root: Object3D, origin: RigOrigin = 'imported'): Rig | null {
  const corrected = characterExtrasIn(root)?.roles ?? {}
  const bones = rigBonesOf(root).map(bone => {
    const role = corrected[bone.name]
    return role ? { ...bone, role } : bone
  })

  return bones.length > 0 && rigFaultOf(bones) === null ? { bones, origin } : null
}

/**
 * What the studio wrote into this file, wherever the loader hung it.
 *
 * 🛑 Searched rather than read off the root: `GLTFLoader` puts a scene's `extras` on the scene it
 * makes, and an engine holding that scene inside a placement of its own would find nothing there.
 */
export function characterExtrasIn(root: Object3D): CharacterExtras | null {
  let found: CharacterExtras | null = null
  root.traverse(object => {
    found ??= characterExtrasOf(object.userData)
  })

  return found
}

/**
 * Where each bone stands in its BIND pose, which is the pose a rig holds.
 *
 * 🛑 A file exported mid-animation has nodes that are not the bind pose; the inverse bind matrices
 * are it by definition, so a skinned bone is read from them and only a loose one from the graph.
 */
function bindPlacesOf(root: Object3D): Map<string, Matrix4> {
  root.updateWorldMatrix(false, true)

  const places = new Map<string, Matrix4>()
  root.traverse(object => {
    if (object.name && !places.has(object.name)) places.set(object.name, object.matrixWorld.clone())
  })

  for (const skinned of skinnedIn(root)) {
    skinned.skeleton.bones.forEach((bone, index) => {
      const inverse = skinned.skeleton.boneInverses[index]
      if (!bone.name || !inverse) return

      places.set(
        bone.name,
        new Matrix4().copy(skinned.bindMatrix).multiply(inverse.clone().invert()),
      )
    })
  }

  return places
}

function skinnedIn(root: Object3D): SkinnedMesh[] {
  const found: SkinnedMesh[] = []
  root.traverse(object => {
    if (Reflect.get(object, 'isSkinnedMesh') === true) found.push(object as SkinnedMesh)
  })

  return found
}

/** Euler XYZ, which is the order `bonesOfRig` reads a rest back in. */
function transformOf(matrix: Matrix4): Transform {
  const position = new Vector3()
  const quaternion = new Quaternion()
  const scale = new Vector3()
  matrix.decompose(position, quaternion, scale)
  const rotation = new Euler().setFromQuaternion(quaternion)

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    scale: { x: scale.x, y: scale.y, z: scale.z },
  }
}

function hasBone(root: Object3D): boolean {
  let found = false
  root.traverse(object => {
    if (Reflect.get(object, 'isBone') === true) found = true
  })

  return found
}
