import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Quaternion,
  Scene,
  Vector3,
} from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { describe, expect, it } from 'vitest'

/**
 * The three.js behaviour `SceneRenderer.refreshGizmoMatrices` exists to work around, so that a
 * version bump which fixes or changes it is seen here rather than through a dead workaround.
 *
 * `TransformControls` turns its drag plane to face the eye for the axis being held, and only in
 * `updateMatrixWorld` — which a RENDER alone calls. The studio draws on demand and a hover asks
 * for no frame, so the plane keeps the orientation of the view one has quitted. Measured in the
 * running app on 2026-08-19: normal (0,-1,0) held over from « De dessus », ray·normal 0 in
 * « De gauche » and 0.0001 in « De face » — the handle lit up and the drag moved nothing.
 *
 * **ITS BLIND SPOT, and it is total: this file never loads `SceneRenderer`.** Deleting
 * `refreshGizmoMatrices`, or unhooking it from `axis-changed`, leaves both cases GREEN. Nothing
 * guards the wiring — mounting the engine needs a WebGL context, which jsdom has none of — so the
 * only proof it is called is the gesture on screen.
 */

const HOST = { width: 2056, height: 1200 }

function sideCamera(offset: Vector3): OrthographicCamera {
  const camera = new OrthographicCamera(-5, 5, 3, -3, 0.1, 1000)
  camera.position.copy(offset).multiplyScalar(10)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

/** A `domElement` that answers what the controls read, without a document to hang it on. */
function stubElement(): HTMLElement {
  return {
    style: {},
    ownerDocument: { pointerLockElement: null },
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, ...HOST }),
    clientWidth: HOST.width,
    clientHeight: HOST.height,
  } as unknown as HTMLElement
}

/** How squarely the ray of a view meets the plane. Zero is parallel, so nothing intersects. */
function rayAgainstPlane(controls: TransformControls, camera: OrthographicCamera): number {
  // `_plane` is three's own member and the whole subject here; it publishes no accessor for it.
  const plane = (controls as unknown as { _plane: Mesh })._plane
  const normal = new Vector3(0, 0, 1).applyQuaternion(plane.getWorldQuaternion(new Quaternion()))
  return Math.abs(camera.getWorldDirection(new Vector3()).dot(normal))
}

describe('the gizmo drag plane', () => {
  const build = () => {
    const scene = new Scene()
    const object = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
    scene.add(object)

    const top = sideCamera(new Vector3(0, 1, 0))
    const controls = new TransformControls(top, stubElement())
    scene.add(controls.getHelper())
    controls.attach(object)
    return { scene, controls, top, left: sideCamera(new Vector3(-1, 0, 0)) }
  }

  it('comes out parallel to the new view when no frame has run since the axis changed', () => {
    const { scene, controls, left } = build()

    // A frame in the top view, holding the axis one grabs there.
    controls.axis = 'X'
    scene.updateMatrixWorld(true)

    // The pointer moves to the left view and grabs a vertical axis. A hover renders nothing.
    controls.camera = left
    controls.axis = 'Y'

    expect(rayAgainstPlane(controls, left)).toBeLessThan(0.001)
  })

  it('faces the view being worked in as soon as the matrices are refreshed', () => {
    const { scene, controls, left } = build()

    controls.axis = 'X'
    scene.updateMatrixWorld(true)

    controls.camera = left
    controls.axis = 'Y'
    // What `refreshGizmoMatrices` does, and the only thing it does.
    controls.getHelper().updateMatrixWorld(true)

    expect(rayAgainstPlane(controls, left)).toBeGreaterThan(0.999)
  })
})
