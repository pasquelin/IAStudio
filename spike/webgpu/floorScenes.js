/**
 * La scène des deux mesures « 64 contre 16 » : des groupes entre 4 et 60, cinq formes, un
 * matériau par groupe, textures et ombres. Un corps sur six bouge à chaque frame.
 *
 * Le regroupement n'est PAS refait par frame : `SceneRenderer` réécrit les slots des noeuds qui
 * ont bougé (`InstancedGroups.moved`), et c'est ce re-upload d'`instanceMatrix` qu'on mesure.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
  Vector3,
} from 'three'

const WIDTH = 1600
const HEIGHT = 900
/** Des tailles de part et d'autre de 16 et de 64 : c'est ce que les deux planchers séparent. */
export const GROUPS = [4, 8, 12, 20, 30, 45, 60, 8, 16, 24, 40, 55, 12, 36, 50, 60, 20, 44]
export const MOVING_SHARE = 6

function checker(size = 128) {
  const data = new Uint8Array(size * size * 4)
  for (let at = 0; at < size * size; at++) {
    const on = (((at % size) >> 4) + ((at / size) | 0) >> 4) % 2 === 0
    data[at * 4] = on ? 210 : 60
    data[at * 4 + 1] = on ? 200 : 70
    data[at * 4 + 2] = on ? 190 : 90
    data[at * 4 + 3] = 255
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

const shapes = () => [
  new BoxGeometry(1, 1, 1),
  new SphereGeometry(0.6, 20, 14),
  new CylinderGeometry(0.5, 0.5, 1.2, 18),
  new ConeGeometry(0.6, 1.2, 18),
  new TorusKnotGeometry(0.45, 0.15, 48, 10),
]

const place = (index, total) => {
  const side = Math.ceil(Math.cbrt(total))
  const half = (side - 1) / 2
  return new Vector3(
    ((index % side) - half) * 2.6,
    ((Math.floor(index / side) % side) - half) * 2.6,
    (Math.floor(index / (side * side)) - half) * 2.6,
  )
}

/**
 * `floor` décide seulement quels groupes passent par un `InstancedMesh` : sous le plancher, les
 * corps sont dessinés un par un, exactement comme le moteur les laisse.
 */
export function build(floor) {
  const scene = new Scene()
  scene.background = new Color(0x11131a)
  scene.add(new AmbientLight(0xffffff, 0.4))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(40, 70, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -60
  sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60
  sun.shadow.camera.bottom = -60
  sun.shadow.camera.far = 300
  scene.add(sun)

  const total = GROUPS.reduce((sum, size) => sum + size, 0)
  const geometries = shapes()
  const texture = checker()
  const camera = new PerspectiveCamera(55, WIDTH / HEIGHT, 0.1, 1000)
  const reach = Math.ceil(Math.cbrt(total)) * 2.6
  camera.position.set(reach * 1.1, reach * 0.7, reach * 1.6)
  camera.lookAt(0, 0, 0)

  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const scale = new Vector3(1, 1, 1)
  const movers = []
  let index = 0

  for (const [group, size] of GROUPS.entries()) {
    const geometry = geometries[group % geometries.length]
    const material = new MeshStandardMaterial({
      roughness: 0.2 + (group % 4) * 0.2,
      metalness: group % 3 === 0 ? 0.8 : 0.1,
      map: group % 2 === 0 ? texture : null,
    })
    material.color = new Color().setHSL((group / GROUPS.length) % 1, 0.5, 0.55)

    if (size >= floor) {
      const instance = new InstancedMesh(geometry, material, size)
      instance.castShadow = true
      instance.receiveShadow = true
      for (let slot = 0; slot < size; slot++) {
        matrix.compose(place(index + slot, total), rotation, scale)
        instance.setMatrixAt(slot, matrix)
      }
      instance.instanceMatrix.needsUpdate = true
      instance.computeBoundingSphere()
      scene.add(instance)
      for (let slot = 0; slot < size; slot++) {
        if ((index + slot) % MOVING_SHARE === 0) movers.push({ instance, slot, at: index + slot })
      }
    } else {
      for (let slot = 0; slot < size; slot++) {
        const mesh = new Mesh(geometry, material)
        mesh.position.copy(place(index + slot, total))
        mesh.castShadow = true
        mesh.receiveShadow = true
        scene.add(mesh)
        if ((index + slot) % MOVING_SHARE === 0) movers.push({ mesh, at: index + slot })
      }
    }
    index += size
  }

  const update = frame => {
    const time = frame * 0.016
    for (const mover of movers) {
      const spot = place(mover.at, total)
      spot.y += Math.sin(time + mover.at) * 1.5
      if (mover.instance) {
        matrix.compose(spot, rotation, scale)
        mover.instance.setMatrixAt(mover.slot, matrix)
        mover.instance.instanceMatrix.needsUpdate = true
      } else {
        mover.mesh.position.copy(spot)
      }
    }
  }

  return { scene, camera, update, total, movers: movers.length }
}
