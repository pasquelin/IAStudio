import {
  DirectionalLight,
  HemisphereLight,
  MeshStandardMaterial,
  PointLight,
  SpotLight,
  type BufferGeometry,
  type Light,
  type Mesh,
  type SpriteMaterial,
} from 'three'
import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  SpriteDescriptor,
  Vector3,
} from '@shared/domain/scene'
import { bareLight, geometryFor } from './three-factory'

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

/** The material a mesh was built with. Arrays are never built here, and neither is any other. */
export function standardMaterialOf(mesh: Mesh): MeshStandardMaterial | null {
  return mesh.material instanceof MeshStandardMaterial ? mesh.material : null
}
