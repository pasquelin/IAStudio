import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three'
import { geometryFor } from '../scene/three-factory'

/**
 * The probes an environment is judged by. A skybox is not judged as a picture but by what it
 * lights: a chrome sphere shows what the scene reflects, a matte sphere shows the diffuse
 * colour it receives, and a ground plane shows where the light falls and how hard.
 *
 * They are ordinary meshes with no light of their own — everything they show comes from
 * `scene.environment`, which is the point.
 */
export type TestObjects = {
  readonly group: Group
  setVisible: (visible: boolean) => void
  setGroundVisible: (visible: boolean) => void
  dispose: () => void
}

const SPHERE_RADIUS = 1
const SPHERE_OFFSET = 1.4
const GROUND_SIZE = 40

export type TestObjectsOptions = {
  /**
   * How far in front of the origin the two spheres sit, along `+Z`. Zero for a camera that
   * orbits them; a few units for one standing at the centre of the environment, which would
   * otherwise be inside them. The ground stays centred either way — it is underfoot, not ahead.
   */
  probeDistance?: number
}

export function createTestObjects({ probeDistance = 0 }: TestObjectsOptions = {}): TestObjects {
  const group = new Group()

  const sphere = (): BufferGeometry =>
    geometryFor({ kind: 'sphere', radius: SPHERE_RADIUS, widthSegments: 64, heightSegments: 32 })

  // Roughness just above zero rather than at it: a perfect mirror shows the environment's own
  // mip level 0, and any compression artefact in the source reads as a defect of the studio.
  const chrome = new Mesh(sphere(), new MeshStandardMaterial({ metalness: 1, roughness: 0.05 }))
  chrome.position.set(-SPHERE_OFFSET, SPHERE_RADIUS, probeDistance)

  const matte = new Mesh(sphere(), new MeshStandardMaterial({ metalness: 0, roughness: 0.9 }))
  matte.position.set(SPHERE_OFFSET, SPHERE_RADIUS, probeDistance)

  const ground = new Mesh(
    geometryFor({ kind: 'plane', width: GROUND_SIZE, height: GROUND_SIZE }),
    new MeshStandardMaterial({ metalness: 0, roughness: 0.8 }),
  )
  // `PlaneGeometry` stands upright; a ground has to be laid down.
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true

  group.add(chrome, matte, ground)

  const meshes = [chrome, matte, ground]

  return {
    group,

    setVisible: visible => {
      group.visible = visible
    },

    setGroundVisible: visible => {
      ground.visible = visible
    },

    dispose: () => {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      group.clear()
    },
  }
}
