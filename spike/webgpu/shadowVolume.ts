import { Box3, Matrix4, Vector3, type Object3D, type PerspectiveCamera } from 'three'

/**
 * Le volume qu'une carte d'ombre doit couvrir, construit sur ce que la CAMÉRA voit.
 *
 * Aujourd'hui `fitShadowCamera` pose une boîte carrée de la diagonale de la scène, centrée sur la
 * LUMIÈRE : elle couvre tout le niveau quoi que l'on regarde. C2 l'a mesuré — en vue tournée, la
 * passe d'ombre dessine encore le niveau entier pendant que la couleur descend de 30 %.
 *
 * 🛑 Rien n'est déplacé dans le document. Une caméra orthographique accepte une boîte
 * ASYMÉTRIQUE, donc le volume se décale en jouant sur `left/right/top/bottom/near/far` autour de
 * la lumière là où elle est. Déplacer la lumière marcherait aussi — l'éclairage directionnel est
 * invariant par translation — mais ferait voyager sa poignée et son aide à l'écran.
 */

/** Ce que la caméra d'ombre doit porter, dans SON repère : une boîte, éventuellement décalée. */
export type ShadowBox = {
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
}

export type ShadowFit = 'scene' | 'view' | 'viewCasters'

export const SHADOW_FITS: readonly ShadowFit[] = ['scene', 'view', 'viewCasters']

const CORNER = new Vector3()
const TO_LIGHT = new Matrix4()

/** Les huit coins du frustum de la caméra, en monde, tronqués à `far` s'il est plus court. */
export function frustumCorners(camera: PerspectiveCamera, far: number, out: Vector3[]): Vector3[] {
  const held = camera.far
  if (far > 0 && far < held) {
    camera.far = far
    camera.updateProjectionMatrix()
  }
  const unproject = new Matrix4().multiplyMatrices(
    camera.matrixWorld,
    camera.projectionMatrixInverse,
  )
  let at = 0
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        const corner = out[at] ?? new Vector3()
        corner.set(x, y, z).applyMatrix4(unproject)
        out[at] = corner
        at += 1
      }
    }
  }
  if (camera.far !== held) {
    camera.far = held
    camera.updateProjectionMatrix()
  }
  return out
}

/**
 * La boîte que la carte doit couvrir, dans le repère de la caméra d'ombre.
 *
 * `view` prend le frustum de la caméra et rien d'autre : c'est ce qu'il faut ÉCLAIRER, mais pas ce
 * qu'il faut DESSINER — un corps entre le soleil et cette zone y projette et serait perdu.
 * `viewCasters` recule donc le plan proche jusqu'au bord de la scène le long de l'axe de la
 * lumière. Les côtés, eux, ne s'élargissent PAS : la lumière est directionnelle, donc ses rayons
 * sont parallèles, et un corps hors de ces côtés projette hors de la zone visible. C'est
 * géométriquement exact, pas une marge choisie.
 */
export function shadowBoxFor(
  fit: ShadowFit,
  shadowCamera: Object3D,
  camera: PerspectiveCamera,
  scene: Box3,
  shadowFar: number,
  sceneExtent: number,
): ShadowBox {
  if (fit === 'scene') {
    const half = (Math.max(scene.getSize(new Vector3()).x, scene.getSize(new Vector3()).z) * Math.SQRT2) / 2
    return { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: sceneExtent * 4 }
  }

  shadowCamera.updateMatrixWorld()
  TO_LIGHT.copy(shadowCamera.matrixWorld).invert()

  const corners = frustumCorners(camera, shadowFar, [])
  const box = new Box3()
  for (const corner of corners) box.expandByPoint(CORNER.copy(corner).applyMatrix4(TO_LIGHT))

  // La boîte de la SCÈNE, dans le même repère : rien n'existe au-delà, donc l'intersection est
  // exacte. Sans elle le frustum d'une caméra — mille unités de portée — donne une boîte de 2 126
  // là où la scène en fait 136, et la carte d'ombre est plus grossière qu'avant. Mesuré.
  const world = new Box3()
  for (const x of [scene.min.x, scene.max.x]) {
    for (const y of [scene.min.y, scene.max.y]) {
      for (const z of [scene.min.z, scene.max.z]) {
        world.expandByPoint(CORNER.set(x, y, z).applyMatrix4(TO_LIGHT))
      }
    }
  }
  box.min.max(world.min)
  box.max.min(world.max)
  if (box.isEmpty()) box.copy(world)

  // La caméra d'ombre regarde vers −z dans son propre repère : `near` et `far` sont des distances
  // POSITIVES le long de −z, d'où l'inversion des bornes.
  const near = -box.max.z
  const far = -box.min.z
  if (fit === 'view') {
    return { left: box.min.x, right: box.max.x, top: box.max.y, bottom: box.min.y, near, far }
  }

  // Jusqu'où un corps peut se trouver ENTRE la lumière et la zone visible : le bord de la scène
  // le long de l'axe de la lumière. Les CÔTÉS ne s'élargissent pas — rayons parallèles.
  return {
    left: box.min.x,
    right: box.max.x,
    top: box.max.y,
    bottom: box.min.y,
    near: Math.min(near, -world.max.z),
    far,
  }
}

type Orthographic = ShadowBox & { updateProjectionMatrix: () => void }

/** Pose la boîte sur la caméra d'ombre. Rien d'autre du document ne bouge. */
export function wearShadowBox(camera: Orthographic, box: ShadowBox): void {
  camera.left = box.left
  camera.right = box.right
  camera.top = box.top
  camera.bottom = box.bottom
  camera.near = box.near
  camera.far = box.far
  camera.updateProjectionMatrix()
}

/** L'aire de la boîte, ce qui dit combien de texels un mètre reçoit — la résolution de l'ombre. */
export const boxSpan = (box: ShadowBox): number =>
  Math.max(box.right - box.left, box.top - box.bottom)
