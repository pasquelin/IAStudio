import {
  DirectionalLight,
  HemisphereLight,
  MeshStandardMaterial,
  PointLight,
  SpotLight,
  type Light,
  type Mesh,
} from 'three'
import type {
  GeometryDescriptor,
  LightDescriptor,
  MaterialDescriptor,
  Vector3,
} from '@shared/domain/scene'
import { geometryFor } from './three-factory'

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

/**
 * A geometry cannot be mutated into another shape, so this one swaps it — and disposes the one
 * it replaces. Left behind, every character typed in a radius field leaks a buffer on the GPU.
 */
export function applyGeometry(mesh: Mesh, descriptor: GeometryDescriptor): void {
  const previous = mesh.geometry
  mesh.geometry = geometryFor(descriptor)
  previous.dispose()
}

/**
 * The light's own parameters. A descriptor never changes kind — the inspector edits a light, it
 * does not convert one — but each branch still checks the class it is about to write to rather
 * than casting: a mismatch leaves the light alone instead of throwing at the user.
 */
export function applyLight(light: Light, descriptor: LightDescriptor): void {
  light.intensity = descriptor.intensity

  switch (descriptor.kind) {
    case 'ambient':
      light.color.set(descriptor.color)
      return

    case 'directional':
      light.color.set(descriptor.color)
      if (light instanceof DirectionalLight) applyTarget(light, descriptor.target)
      return

    case 'hemisphere':
      if (!(light instanceof HemisphereLight)) return
      light.color.set(descriptor.skyColor)
      light.groundColor.set(descriptor.groundColor)
      return

    case 'point':
      light.color.set(descriptor.color)
      if (!(light instanceof PointLight)) return
      light.distance = descriptor.distance
      light.decay = descriptor.decay
      return

    case 'spot':
      light.color.set(descriptor.color)
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
