/**
 * CHANTIER B — les scènes du banc du plancher d'instanciation.
 *
 * Un GROUPE au sens du studio est un couple (géométrie, matériau) : `instancing.ts` compose sa
 * clé de ces deux-là, donc deux corps qui en diffèrent ne partagent pas un appel de dessin. Les
 * scènes ci-dessous reproduisent cela — chaque groupe a sa géométrie ET son matériau.
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

export const TOTAL = 10_000
const WIDTH = 1600
const HEIGHT = 900

function checker(size = 256) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = ((x >> 4) + (y >> 4)) % 2 === 0
      const at = (y * size + x) * 4
      data[at] = on ? 210 : 60
      data[at + 1] = on ? 200 : 70
      data[at + 2] = on ? 190 : 90
      data[at + 3] = 255
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

export const TEXTURE = checker()

/** Les formes qu'un document de scène du studio pose vraiment, du cube au noeud de tore. */
const shapes = () => [
  new BoxGeometry(1, 1, 1),
  new SphereGeometry(0.6, 24, 16),
  new CylinderGeometry(0.5, 0.5, 1.2, 20),
  new ConeGeometry(0.6, 1.2, 20),
  new TorusKnotGeometry(0.45, 0.15, 64, 12),
]

/**
 * Un matériau par groupe, et pas seulement une couleur : une matière du studio porte sa rugosité,
 * son métal et souvent une carte. Un groupe sur deux est texturé.
 */
const materialFor = (index, groups) => {
  const material = new MeshStandardMaterial({
    roughness: 0.2 + (index % 4) * 0.2,
    metalness: index % 3 === 0 ? 0.8 : 0.1,
    map: index % 2 === 0 ? TEXTURE : null,
  })
  material.color = new Color().setHSL((index / Math.max(groups, 1)) % 1, 0.5, 0.55)
  return material
}

const place = (index, count) => {
  const side = Math.ceil(Math.cbrt(count))
  const half = (side - 1) / 2
  return new Vector3(
    ((index % side) - half) * 2.4,
    ((Math.floor(index / side) % side) - half) * 2.4,
    (Math.floor(index / (side * side)) - half) * 2.4,
  )
}

function stage() {
  const scene = new Scene()
  scene.background = new Color(0x11131a)
  scene.add(new AmbientLight(0xffffff, 0.4))
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(30, 60, 20)
  scene.add(sun)
  const reach = Math.ceil(Math.cbrt(TOTAL)) * 2.4
  const camera = new PerspectiveCamera(55, WIDTH / HEIGHT, 0.1, 2000)
  camera.position.set(reach * 0.9, reach * 0.6, reach * 1.4)
  camera.lookAt(0, 0, 0)
  return { scene, camera }
}

/** Le plan de la scène : quel groupe, quelle forme, quelle matière, pour chaque corps. */
function plan(groupSize) {
  const groups = Math.ceil(TOTAL / groupSize)
  const geometries = shapes()
  return {
    groups,
    geometries,
    materials: Array.from({ length: groups }, (_unused, index) => materialFor(index, groups)),
    geometryOf: group => geometries[group % geometries.length],
  }
}

/** Ce que le studio dessine sous le plancher : un appel par corps. */
export function separate(groupSize) {
  const { scene, camera } = stage()
  const laid = plan(groupSize)
  for (let index = 0; index < TOTAL; index++) {
    const group = Math.floor(index / groupSize)
    const mesh = new Mesh(laid.geometryOf(group), laid.materials[group])
    mesh.position.copy(place(index, TOTAL))
    mesh.updateMatrix()
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
  }
  return { scene, camera, groups: laid.groups }
}

/** Le même contenu, un `InstancedMesh` par groupe. */
export function instanced(groupSize) {
  const { scene, camera } = stage()
  const laid = plan(groupSize)
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const scale = new Vector3(1, 1, 1)

  for (let group = 0; group < laid.groups; group++) {
    const size = Math.min(groupSize, TOTAL - group * groupSize)
    const mesh = new InstancedMesh(laid.geometryOf(group), laid.materials[group], size)
    for (let slot = 0; slot < size; slot++) {
      matrix.compose(place(group * groupSize + slot, TOTAL), rotation, scale)
      mesh.setMatrixAt(slot, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    scene.add(mesh)
  }
  return { scene, camera, groups: laid.groups }
}

export function dispose(built) {
  built.scene.traverse(object => {
    if (object.geometry) object.geometry.dispose()
    const material = object.material
    if (Array.isArray(material)) material.forEach(one => one.dispose())
    else if (material) material.dispose()
  })
}
