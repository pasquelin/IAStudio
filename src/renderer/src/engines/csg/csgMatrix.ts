import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import type { Transform } from '@shared/domain/transform'

/**
 * A placement and its matrix, both ways.
 *
 * Its own module so the CSG worker can bake a brush without importing anything of the scene:
 * `carve.ts` reads `SceneNode`, and pulling that into a worker bundle would carry the studio's
 * whole node model across for two conversions.
 */
export function matrixOfTransform(transform: Transform): Matrix4 {
  return new Matrix4().compose(
    new Vector3(transform.position.x, transform.position.y, transform.position.z),
    new Quaternion().setFromEuler(
      new Euler(transform.rotation.x, transform.rotation.y, transform.rotation.z),
    ),
    new Vector3(transform.scale.x, transform.scale.y, transform.scale.z),
  )
}

/**
 * The placement a matrix describes. Only ever fed a matrix free of shear — `decompose` cannot
 * describe one that has any, which is why `carveGraph` keeps the solid's frame an isometry.
 */
export function transformOfMatrix(matrix: Matrix4): Transform {
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
