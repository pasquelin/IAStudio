import { BasicShadowMap, PCFShadowMap, type Object3D } from 'three'
import type { LightShadow, ShadowMapType } from 'three'
import type { ShadowQuality } from '@shared/domain/scene'
import { isRecord } from '@shared/guards'

/** The one place the studio's words meet three.js's map types. */
const MAP_TYPES: Record<ShadowQuality, ShadowMapType> = {
  hard: BasicShadowMap,
  soft: PCFShadowMap,
}

/** What of a renderer this reads — narrower than `WebGLRenderer`, which jsdom cannot build. */
type ShadowMapHolder = { shadowMap: { type: ShadowMapType } }

/**
 * Points the renderer at the map type a setting asks for. Nothing else to do: three.js watches
 * the type itself and recompiles what it has to — `shadowMap.needsUpdate` is read only when
 * `autoUpdate` is off, which it never is here.
 */
export function applyShadowQuality(renderer: ShadowMapHolder, quality: ShadowQuality): void {
  renderer.shadowMap.type = MAP_TYPES[quality]
}

/**
 * The flags a node carries, put on the object that stands for it — and on everything under it,
 * since three.js reads them per mesh and a model is one node over a whole imported tree.
 */
export function applyShadowFlags(object: Object3D, cast: boolean, receive: boolean): void {
  object.traverse(child => {
    child.castShadow = cast
    child.receiveShadow = receive
  })
}

/**
 * The side of the square map a light allocates. The map was sized when it was built, so it is
 * dropped rather than resized: three.js only reallocates one it finds missing.
 */
export function resizeShadowMap(object: Object3D, size: number): void {
  if (!castsShadow(object) || object.shadow.mapSize.width === size) return

  object.shadow.mapSize.set(size, size)
  object.shadow.map?.dispose()
  object.shadow.map = null
}

/**
 * How far a directional light's shadow reaches. Its frustum is a box, ten units wide by default
 * — a set laid out on a twenty-metre grid would have half of it throwing nothing, with no hint
 * as to why. Sized from the grid, which is what the scene is built against.
 */
export function fitShadowCamera(object: Object3D, extent: number): void {
  if (!castsShadow(object) || !isOrthographic(object.shadow.camera)) return

  const half = extent / 2
  const camera = object.shadow.camera
  if (camera.right === half) return

  camera.left = -half
  camera.right = half
  camera.top = half
  camera.bottom = -half
  // three.js never reads these back on its own, exactly like a perspective `fov`.
  camera.updateProjectionMatrix()
}

// Structural rather than `instanceof`: three exports `LightShadow` as a type alone.
function castsShadow(object: Object3D): object is Object3D & { shadow: LightShadow } {
  return 'shadow' in object && isRecord(object.shadow) && 'mapSize' in object.shadow
}

type Orthographic = {
  left: number
  right: number
  top: number
  bottom: number
  updateProjectionMatrix: () => void
}

/** A spot and a point light shadow through a perspective camera, which has no box to size. */
function isOrthographic(camera: unknown): camera is Orthographic {
  return isRecord(camera) && 'isOrthographicCamera' in camera
}
