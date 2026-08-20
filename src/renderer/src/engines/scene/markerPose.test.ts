import { Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { LightDescriptor } from '@shared/domain/scene'
import { aimLightMarker, holdMarkerSize } from './markerPose'

const spot = (target: { x: number; y: number; z: number }): LightDescriptor => ({
  kind: 'spot',
  color: '#ffffff',
  intensity: 1,
  distance: 0,
  angle: 0.4,
  penumbra: 0,
  decay: 2,
  target,
})

/** A marker as it hangs in the scene: under the light, which itself hangs under something. */
function hung(): { marker: Object3D; light: Object3D; scene: Object3D } {
  const scene = new Object3D()
  const light = new Object3D()
  const marker = new Object3D()
  scene.add(light)
  light.add(marker)
  return { marker, light, scene }
}

function facingOf(marker: Object3D): Vector3 {
  marker.updateWorldMatrix(true, false)
  return marker.getWorldDirection(new Vector3())
}

describe('aimLightMarker', () => {
  /**
   * The direction a `directional` or a `spot` lights is its TARGET, a point — never the node's
   * rotation, which three.js reads for neither. A body aimed by the rotation would point one way
   * while the beam went another.
   */
  it('aims a spot at the point its beam lands on', () => {
    const { marker, light } = hung()
    light.position.set(0, 3, 0)

    aimLightMarker(marker, spot({ x: 0, y: 0, z: 0 }))

    expect(facingOf(marker).y).toBeCloseTo(-1, 5)
  })

  /**
   * The target is a point in WORLD space, so a turned parent moves the lamp and not the point:
   * hung at (0, 3, 0) under a quarter turn, the lamp stands at (−3, 0, 0) and lights towards +X.
   */
  it('holds that aim through a parent that has been turned', () => {
    const { marker, light, scene } = hung()
    scene.rotation.z = Math.PI / 2
    light.position.set(0, 3, 0)
    scene.updateMatrixWorld(true)

    aimLightMarker(marker, spot({ x: 0, y: 0, z: 0 }))

    const facing = facingOf(marker)
    expect(facing.x).toBeCloseTo(1, 5)
    expect(facing.y).toBeCloseTo(0, 5)
  })

  /** three.js lights a hemisphere from +Y in world space, and from nowhere else. */
  it('stands a hemisphere globe upright under a turned node', () => {
    const { marker, light, scene } = hung()
    light.rotation.x = Math.PI / 3
    scene.rotation.z = Math.PI / 4
    scene.updateMatrixWorld(true)

    aimLightMarker(marker, {
      kind: 'hemisphere',
      skyColor: '#fff',
      groundColor: '#000',
      intensity: 1,
    })

    marker.updateWorldMatrix(true, false)
    const up = new Vector3(0, 1, 0).applyQuaternion(
      marker.getWorldQuaternion(marker.quaternion.clone()),
    )
    expect(up.y).toBeCloseTo(1, 5)
  })

  /** A bulb has no front: turning the node turns it, and nothing about that reads wrong. */
  it('leaves a lamp with no direction where the node put it', () => {
    const { marker, light } = hung()
    light.rotation.y = Math.PI / 5
    marker.rotation.y = 0.3

    aimLightMarker(marker, { kind: 'point', color: '#fff', intensity: 1, distance: 0, decay: 2 })

    expect(marker.rotation.y).toBeCloseTo(0.3, 5)
  })
})

describe('holdMarkerSize', () => {
  /** A lamp has no size: stretching its node must not squash the shape that says what it is. */
  it('keeps a marker its own shape under a stretched node', () => {
    const { marker, light } = hung()
    light.scale.set(2, 0.5, 4)
    light.updateMatrixWorld(true)

    holdMarkerSize(marker)

    marker.updateWorldMatrix(true, false)
    const size = marker.getWorldScale(new Vector3())
    expect(size.x).toBeCloseTo(1, 5)
    expect(size.y).toBeCloseTo(1, 5)
    expect(size.z).toBeCloseTo(1, 5)
  })

  /** An axis typed to zero is reachable from the inspector, and dividing by it writes NaN. */
  it('survives a node scaled to nothing', () => {
    const { marker, light } = hung()
    light.scale.set(0, 1, 1)
    light.updateMatrixWorld(true)

    holdMarkerSize(marker)

    expect(Number.isFinite(marker.scale.x)).toBe(true)
  })
})
