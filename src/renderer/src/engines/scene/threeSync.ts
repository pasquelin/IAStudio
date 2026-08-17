import {
  CameraHelper,
  DirectionalLight,
  HemisphereLight,
  Line,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SpotLight,
  type BufferGeometry,
  type Light,
  type Object3D,
  type PerspectiveCamera,
  type SpriteMaterial,
} from 'three'
import type {
  CameraDescriptor,
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  PathDescriptor,
  SpriteDescriptor,
  Vector3,
} from '@shared/domain/scene'
import { pathPoints } from './cameraPath'
import { bareLight, geometryFor, pathKnob, PATH_CURVE_NAME, PATH_KNOB_PREFIX } from './threeFactory'

/*
 * Bringing an existing three.js object in line with an edited descriptor — the other half of
 * `three-factory`, which only ever builds. Out of `SceneRenderer` for the same reason: none of
 * it needs a GL context, so it is the half that can be tested.
 */

/**
 * Mutates the material rather than replacing it: a new `MeshStandardMaterial` costs a shader
 * program compiled on the next frame, and the inspector emits a value per pointer move.
 */
export function applyMaterial(
  material: MeshStandardMaterial,
  descriptor: MaterialDescriptor,
  fallbackColor: string,
): void {
  const color = descriptor.color ?? fallbackColor
  if (color) material.color.set(color)
  material.roughness = descriptor.roughness
  material.metalness = descriptor.metalness
}

/** The second UV set an occlusion map needs. Absent from every primitive the studio builds. */
export function giveSecondUvSet(geometry: BufferGeometry): void {
  const uv = geometry.attributes.uv
  if (uv && !geometry.attributes.uv1) geometry.setAttribute('uv1', uv)
}

/**
 * A geometry cannot be mutated into another shape, so this one swaps it — and disposes the one
 * it replaces. Left behind, every character typed in a radius field leaks a buffer on the GPU.
 */
export function applyGeometry(mesh: Mesh, descriptor: GeometryDescriptor): void {
  const previous = mesh.geometry
  const next = geometryFor(descriptor)
  // The new shape inherits the second UV set, or an occlusion map already in place would stop
  // doing anything the moment a radius is nudged.
  if (previous.attributes.uv1) giveSecondUvSet(next)

  mesh.geometry = next
  previous.dispose()
}

/**
 * The sprite's own parameters. `transparent` is deliberately left alone: `SpriteMaterial` turns
 * it on in its constructor — "sprite materials are transparent", says three.js — and switching it
 * off at full opacity would make every picture with an alpha channel draw its whole quad.
 */
export function applySprite(
  material: SpriteMaterial,
  descriptor: SpriteDescriptor,
  fallbackColor: string,
): void {
  material.color.set(descriptor.color ?? fallbackColor)
  material.opacity = descriptor.opacity
}

/** A light of the right class, carrying what its descriptor says. */
export function lightFor(descriptor: LightDescriptor): Light {
  const light = bareLight(descriptor.kind)
  applyLight(light, descriptor)
  return light
}

/**
 * The light's own parameters. Each branch checks the class it writes to rather than casting: a
 * mismatch leaves the light alone instead of throwing at the user.
 */
export function applyLight(light: Light, descriptor: LightDescriptor): void {
  light.intensity = descriptor.intensity
  if (descriptor.kind !== 'hemisphere') light.color.set(descriptor.color)

  switch (descriptor.kind) {
    case 'directional':
      if (light instanceof DirectionalLight) applyTarget(light, descriptor.target)
      return

    case 'hemisphere':
      if (!(light instanceof HemisphereLight)) return
      light.color.set(descriptor.skyColor)
      light.groundColor.set(descriptor.groundColor)
      return

    case 'point':
      if (!(light instanceof PointLight)) return
      light.distance = descriptor.distance
      light.decay = descriptor.decay
      return

    case 'spot':
      if (!(light instanceof SpotLight)) return
      light.distance = descriptor.distance
      light.angle = descriptor.angle
      light.penumbra = descriptor.penumbra
      light.decay = descriptor.decay
      applyTarget(light, descriptor.target)
  }
}

function applyTarget(light: DirectionalLight | SpotLight, target: Vector3): void {
  light.target.position.set(target.x, target.y, target.z)
  // The helper reads the target's world matrix, and nothing else updates it before the frame
  // that draws it: without this the beam points where the light aimed one edit ago.
  light.target.updateMatrixWorld()
}

/**
 * The lens of a camera of the scene, and the frustum drawn from it.
 *
 * The helper is updated by hand: it reads the projection matrix once, so a camera whose field of
 * view was just typed in would keep outlining the one it had before.
 */
export function applyCamera(camera: PerspectiveCamera, descriptor: CameraDescriptor): void {
  camera.fov = descriptor.fov
  camera.near = descriptor.near
  camera.far = descriptor.far
  camera.updateProjectionMatrix()

  for (const child of camera.children) {
    if (child instanceof CameraHelper) child.update()
  }
}

/**
 * A rail brought in line with its descriptor: the sampled line, and one knob per control point.
 *
 * Knobs are added and removed rather than rebuilt whole: a drag of one point emits a descriptor
 * per pointer move, and disposing every sphere each time would churn the GPU for a curve that
 * has not changed shape.
 */
export function applyPath(object: Object3D, descriptor: PathDescriptor, colour: string): void {
  const line = object.getObjectByName(PATH_CURVE_NAME)
  if (line instanceof Line) line.geometry.setFromPoints(pathPoints(descriptor))

  const knobs = object.children.filter(
    (child): child is Mesh => child.name.startsWith(PATH_KNOB_PREFIX) && child instanceof Mesh,
  )

  for (const extra of knobs.slice(descriptor.points.length)) {
    object.remove(extra)
    extra.geometry.dispose()
  }

  for (const [index, point] of descriptor.points.entries()) {
    const knob = knobs[index] ?? pathKnob(index, colour)
    if (!knobs[index]) object.add(knob)
    knob.position.set(point.x, point.y, point.z)
  }
}

/** The material a mesh was built with. Arrays are never built here, and neither is any other. */
export function standardMaterialOf(mesh: Mesh): MeshStandardMaterial | null {
  return mesh.material instanceof MeshStandardMaterial ? mesh.material : null
}
