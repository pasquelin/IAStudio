import {
  Box3,
  Box3Helper,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Vector3,
  type Material,
} from 'three'
import { rootColour } from '../core/palette'
import type { AdaptiveRigDebug } from './adaptiveGeometricRig'

export type AdaptiveRigDebugView = {
  group: Group
  dispose: () => void
}

export function createAdaptiveRigDebugView(debug: AdaptiveRigDebug): AdaptiveRigDebugView {
  const group = new Group()
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const box = new Box3Helper(
    new Box3(vector(debug.robustBounds.min), vector(debug.robustBounds.max)),
    new Color(rootColour('--color-muted')),
  )
  group.add(box)
  const size = debugSize(debug)
  group.add(symmetryPlane(debug, size, geometries, materials))
  group.add(lines(sectionLines(debug), '--color-muted', geometries, materials))
  group.add(lines(axisLines(debug, size), '--color-accent', geometries, materials))
  group.add(
    points(
      debug.candidates.map(one => one.landmark.position),
      '--color-warning',
      geometries,
      materials,
    ),
  )
  group.add(
    points(
      [...debug.landmarks.values()].map(one => one.position),
      '--color-accent',
      geometries,
      materials,
    ),
  )
  group.traverse(object => {
    object.raycast = () => {}
  })

  return {
    group,
    dispose: () => {
      box.geometry.dispose()
      if (Array.isArray(box.material)) {
        for (const material of box.material) material.dispose()
      } else box.material.dispose()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    },
  }
}

function debugSize(debug: AdaptiveRigDebug): Vector3 {
  return new Vector3().subVectors(vector(debug.robustBounds.max), vector(debug.robustBounds.min))
}

function symmetryPlane(
  debug: AdaptiveRigDebug,
  size: Vector3,
  geometries: BufferGeometry[],
  materials: Material[],
): Mesh {
  const geometry = new PlaneGeometry(debug.symmetryPlane.normal.x === 0 ? size.x : size.z, size.y)
  const material = new MeshBasicMaterial({
    color: rootColour('--color-accent'),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: DoubleSide,
  })
  const plane = new Mesh(geometry, material)
  plane.position.copy(vector(debug.symmetryPlane.origin))
  if (debug.symmetryPlane.normal.x !== 0) plane.rotation.y = Math.PI / 2
  geometries.push(geometry)
  materials.push(material)
  return plane
}

function sectionLines(debug: AdaptiveRigDebug): number[] {
  return debug.sections
    .filter(section => section.points > 0)
    .flatMap(section => {
      const centre = vector(section.centre)
      const across = vector(debug.axes.left).multiplyScalar(section.halfWidth)
      const forward = vector(debug.axes.forward).multiplyScalar(section.halfDepth)
      return [
        ...centre.clone().sub(across),
        ...centre.clone().add(across),
        ...centre.clone().sub(forward),
        ...centre.clone().add(forward),
      ]
    })
}

function axisLines(debug: AdaptiveRigDebug, size: Vector3): number[] {
  const origin = vector(debug.symmetryPlane.origin)
  const length = Math.max(size.x, size.y, size.z) * 0.25
  return [
    ...origin,
    ...origin.clone().add(vector(debug.axes.vertical).multiplyScalar(length)),
    ...origin,
    ...origin.clone().add(vector(debug.axes.left).multiplyScalar(length)),
    ...origin,
    ...origin.clone().add(vector(debug.axes.forward).multiplyScalar(length)),
  ]
}

function lines(
  values: readonly number[],
  colour: string,
  geometries: BufferGeometry[],
  materials: Material[],
): LineSegments {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(values), 3))
  const material = new LineBasicMaterial({ color: rootColour(colour) })
  geometries.push(geometry)
  materials.push(material)
  return new LineSegments(geometry, material)
}

function points(
  values: readonly { x: number; y: number; z: number }[],
  colour: string,
  geometries: BufferGeometry[],
  materials: Material[],
): Points {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(values.flatMap(value => [value.x, value.y, value.z])), 3),
  )
  const material = new PointsMaterial({
    color: rootColour(colour),
    size: 5,
    sizeAttenuation: false,
    depthTest: false,
  })
  geometries.push(geometry)
  materials.push(material)
  return new Points(geometry, material)
}

function vector(value: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(value.x, value.y, value.z)
}
