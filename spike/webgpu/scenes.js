/**
 * Les scènes du banc. Elles ne connaissent AUCUN backend : le core de three est partagé entre
 * `three` et `three/webgpu` (les deux builds importent `three.core.js`), donc un `Mesh` construit
 * ici est le même objet des deux côtés — c'est ce qui rend la comparaison honnête.
 *
 * Chaque scène rend `{ scene, camera, update, dispose }`. `update(frame)` est le coût CPU par
 * frame HORS rendu : c'est lui qui répond à « la synchro coûte-t-elle plus cher que le backend ».
 */
import {
  AmbientLight,
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Bone,
  Color,
  DataTexture,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Fog,
  GridHelper,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  QuaternionKeyframeTrack,
  RGBAFormat,
  Raycaster,
  RepeatWrapping,
  Scene,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SpotLight,
  TorusKnotGeometry,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from 'three'

/** Un générateur reproductible : deux backends doivent voir la MÊME scène, au flottant près. */
function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Damier procédural : pas d'I/O, donc pas de latence disque dans une mesure de rendu. */
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

const cubeRoot = count => Math.ceil(Math.cbrt(count))

/** Une grille cubique : la caméra en voit une part comparable quel que soit le compte. */
function placeOnGrid(index, count, spread = 2.4) {
  const side = cubeRoot(count)
  const half = (side - 1) / 2
  return new Vector3(
    ((index % side) - half) * spread,
    ((Math.floor(index / side) % side) - half) * spread,
    (Math.floor(index / (side * side)) - half) * spread,
  )
}

function framedCamera(count) {
  const camera = new PerspectiveCamera(55, 16 / 9, 0.1, 2000)
  const reach = cubeRoot(count) * 2.4
  camera.position.set(reach * 0.9, reach * 0.6, reach * 1.4)
  camera.lookAt(0, 0, 0)
  return camera
}

function litScene(withShadows = false) {
  const scene = new Scene()
  scene.background = new Color(0x11131a)
  scene.add(new AmbientLight(0xffffff, 0.35))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(30, 60, 20)
  if (withShadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const reach = 60
    sun.shadow.camera.left = -reach
    sun.shadow.camera.right = reach
    sun.shadow.camera.top = reach
    sun.shadow.camera.bottom = -reach
    sun.shadow.camera.far = 300
  }
  scene.add(sun)
  return scene
}

/** Ce que toute scène du banc doit rendre, pour que la boucle n'ait rien à savoir d'elle. */
const built = (scene, camera, update, extras = {}) => ({
  scene,
  camera,
  update: update ?? (() => {}),
  dispose: () => {
    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose()
      const material = object.material
      if (Array.isArray(material)) material.forEach(one => one.dispose())
      else if (material) material.dispose()
    })
  },
  ...extras,
})

// ─── meshes séparés ────────────────────────────────────────────────────────────────────────

function separateMeshes(count, { moving, texture }) {
  const scene = litScene()
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, map: texture })
  const camera = framedCamera(count)
  const meshes = []
  const random = seeded(7)

  for (let index = 0; index < count; index++) {
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(placeOnGrid(index, count))
    mesh.rotation.set(random() * Math.PI, random() * Math.PI, 0)
    // Statique veut dire statique jusqu'au bout : sans cela three recalcule la matrice monde de
    // chaque objet à chaque frame, et le cas « statique » mesurerait le cas « dynamique ».
    if (!moving) {
      mesh.updateMatrix()
      mesh.matrixAutoUpdate = false
    }
    scene.add(mesh)
    meshes.push(mesh)
  }

  const update = moving
    ? frame => {
        const time = frame * 0.016
        for (let index = 0; index < meshes.length; index++) {
          const mesh = meshes[index]
          mesh.rotation.y = time + index * 0.001
          mesh.position.y += Math.sin(time + index) * 0.002
        }
      }
    : null

  return built(scene, camera, update)
}

// ─── instancing ────────────────────────────────────────────────────────────────────────────

function instanced(count, { moving, texture }) {
  const scene = litScene()
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, map: texture })
  const mesh = new InstancedMesh(geometry, material, count)
  const camera = framedCamera(count)
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const euler = new Euler()
  const scale = new Vector3(1, 1, 1)

  const write = time => {
    for (let index = 0; index < count; index++) {
      euler.set(0, time + index * 0.001, 0)
      rotation.setFromEuler(euler)
      matrix.compose(placeOnGrid(index, count), rotation, scale)
      mesh.setMatrixAt(index, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  write(0)
  scene.add(mesh)
  return built(scene, camera, moving ? frame => write(frame * 0.016) : null)
}

// ─── skinning ──────────────────────────────────────────────────────────────────────────────

/** Une chaîne de quatre os dans un cylindre segmenté — assez pour payer un vrai skinning. */
function skinnedRig(texture) {
  const height = 4
  const segments = 16
  const geometry = new BoxGeometry(0.6, height, 0.6, 2, segments, 2)
  const position = geometry.attributes.position
  const indices = []
  const weights = []
  const bones = 4
  const span = height / bones

  for (let vertex = 0; vertex < position.count; vertex++) {
    const y = position.getY(vertex) + height / 2
    const exact = Math.min(y / span, bones - 1)
    const low = Math.floor(exact)
    const share = exact - low
    indices.push(low, Math.min(low + 1, bones - 1), 0, 0)
    weights.push(1 - share, share, 0, 0)
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4))

  const chain = []
  let parent = null
  for (let index = 0; index < bones; index++) {
    const bone = new Bone()
    bone.position.y = index === 0 ? -height / 2 : span
    if (parent) parent.add(bone)
    parent = bone
    chain.push(bone)
  }

  const material = new MeshStandardMaterial({ map: texture, roughness: 0.7 })
  const mesh = new SkinnedMesh(geometry, material)
  mesh.add(chain[0])
  mesh.bind(new Skeleton(chain))
  return { mesh, chain }
}

function skinnedCrowd(count, { texture }) {
  const scene = litScene()
  const camera = framedCamera(count * 6)
  const mixers = []
  const random = seeded(11)

  for (let index = 0; index < count; index++) {
    const { mesh, chain } = skinnedRig(texture)
    mesh.position.copy(placeOnGrid(index, count, 5))
    scene.add(mesh)

    // Un clip par personnage plutôt qu'un clip partagé : c'est ce qu'une foule coûte vraiment,
    // chaque `AnimationMixer` évaluant ses propres pistes.
    const tracks = chain.slice(1).map((bone, at) => {
      const swing = 0.4 + random() * 0.3
      return new QuaternionKeyframeTrack(
        `${bone.uuid}.quaternion`,
        [0, 0.5, 1],
        [
          ...new Quaternion().setFromEuler(new Euler(-swing, 0, 0)).toArray(),
          ...new Quaternion().setFromEuler(new Euler(swing, 0, at * 0.2)).toArray(),
          ...new Quaternion().setFromEuler(new Euler(-swing, 0, 0)).toArray(),
        ],
      )
    })
    const mixer = new AnimationMixer(mesh)
    mixer.clipAction(new AnimationClip('walk', 1, tracks)).play()
    mixer.setTime(random())
    mixers.push(mixer)
  }

  return built(scene, camera, () => {
    for (const mixer of mixers) mixer.update(0.016)
  })
}

// ─── lumières et ombres ────────────────────────────────────────────────────────────────────

function lightsAndShadows(count, { texture }) {
  const scene = litScene(true)
  const camera = framedCamera(count)
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.55 })
  const reach = cubeRoot(count) * 2.4

  const ground = new Mesh(
    new PlaneGeometry(reach * 4, reach * 4),
    new MeshStandardMaterial({ color: 0x303540, roughness: 0.9 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -reach / 2 - 1
  ground.receiveShadow = true
  scene.add(ground)

  const meshes = []
  for (let index = 0; index < count; index++) {
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(placeOnGrid(index, count))
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    meshes.push(mesh)
  }

  // Deux lampes ponctuelles projetantes en plus du soleil : trois cartes d'ombre à re-cuire,
  // ce qu'une scène d'atelier a réellement.
  const lamps = [new PointLight(0xffd9a0, 60, reach * 6), new SpotLight(0xa0d0ff, 80, reach * 6)]
  for (const lamp of lamps) {
    lamp.castShadow = true
    lamp.shadow.mapSize.set(1024, 1024)
    scene.add(lamp)
  }

  return built(scene, camera, frame => {
    const time = frame * 0.016
    lamps[0].position.set(Math.cos(time) * reach, reach * 0.8, Math.sin(time) * reach)
    lamps[1].position.set(Math.sin(time * 0.7) * reach, reach, Math.cos(time * 0.7) * reach)
    for (let index = 0; index < meshes.length; index++) meshes[index].rotation.y = time + index
  })
}

// ─── picking ───────────────────────────────────────────────────────────────────────────────

const RAYS_PER_FRAME = 20

function pickable(count, { texture }) {
  const scene = litScene()
  const camera = framedCamera(count)
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new MeshStandardMaterial({ map: texture })
  const targets = []
  for (let index = 0; index < count; index++) {
    const mesh = new Mesh(geometry, material)
    mesh.position.copy(placeOnGrid(index, count))
    mesh.updateMatrix()
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
    targets.push(mesh)
  }

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const random = seeded(3)
  let hits = 0

  return built(
    scene,
    camera,
    () => {
      for (let ray = 0; ray < RAYS_PER_FRAME; ray++) {
        pointer.set(random() * 2 - 1, random() * 2 - 1)
        raycaster.setFromCamera(pointer, camera)
        hits += raycaster.intersectObjects(targets, false).length
      }
    },
    { raysPerFrame: RAYS_PER_FRAME, hitsSoFar: () => hits },
  )
}

// ─── scène représentative ──────────────────────────────────────────────────────────────────

/**
 * Ce qu'un document de scène du studio contient vraiment : quelques centaines de corps, des
 * matériaux distincts (donc des programmes distincts), du sol, une grille, du brouillard,
 * des ombres, et une poignée d'objets qui bougent — pas dix mille cubes identiques.
 */
function studioLike(_count, { texture }) {
  const scene = litScene(true)
  scene.fog = new Fog(0x11131a, 40, 160)
  const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 500)
  camera.position.set(24, 16, 30)
  camera.lookAt(0, 2, 0)

  const grid = new GridHelper(120, 120, 0x3a4050, 0x232833)
  scene.add(grid)

  const ground = new Mesh(
    new PlaneGeometry(200, 200),
    new MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const shapes = [
    new BoxGeometry(1.4, 1.4, 1.4),
    new SphereGeometry(0.9, 32, 24),
    new TorusKnotGeometry(0.7, 0.22, 128, 24),
  ]
  // Huit matériaux distincts : c'est le nombre de programmes, pas le nombre d'objets, qui fait
  // le coût de changement d'état d'une vraie scène.
  const materials = Array.from(
    { length: 8 },
    (_, index) =>
      new MeshStandardMaterial({
        map: index % 2 === 0 ? texture : null,
        color: new Color().setHSL(index / 8, 0.45, 0.55),
        roughness: 0.2 + (index % 4) * 0.2,
        metalness: index % 3 === 0 ? 0.8 : 0.1,
      }),
  )

  const random = seeded(23)
  const moving = []
  const BODIES = 420
  for (let index = 0; index < BODIES; index++) {
    const mesh = new Mesh(shapes[index % shapes.length], materials[index % materials.length])
    mesh.position.set((random() - 0.5) * 90, random() * 12 + 0.8, (random() - 0.5) * 90)
    mesh.rotation.set(random() * 3, random() * 3, random() * 3)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    // Un dixième bouge : la proportion d'une scène éditée, où l'essentiel est posé.
    if (index % 10 === 0) moving.push(mesh)
    else {
      mesh.updateMatrix()
      mesh.matrixAutoUpdate = false
    }
  }

  const spot = new SpotLight(0xffffff, 400, 120, 0.6, 0.4)
  spot.position.set(20, 40, 20)
  spot.castShadow = true
  spot.shadow.mapSize.set(2048, 2048)
  scene.add(spot)

  return built(scene, camera, frame => {
    const time = frame * 0.016
    for (let index = 0; index < moving.length; index++) {
      moving[index].rotation.y = time + index
      moving[index].position.y = 1 + Math.abs(Math.sin(time + index)) * 6
    }
    camera.position.set(Math.cos(time * 0.15) * 34, 16, Math.sin(time * 0.15) * 34)
    camera.lookAt(0, 3, 0)
  })
}

// ─── le catalogue ──────────────────────────────────────────────────────────────────────────

const COUNTS = [1000, 10_000, 50_000]

export const CASES = [
  { id: 'static-mesh', label: 'meshes séparés, statiques', counts: COUNTS, build: separateMeshes, options: { moving: false } },
  { id: 'dynamic-mesh', label: 'meshes séparés, transformés chaque frame', counts: COUNTS, build: separateMeshes, options: { moving: true } },
  { id: 'instanced-static', label: 'instancing, statique', counts: COUNTS, build: instanced, options: { moving: false } },
  { id: 'instanced-dynamic', label: 'instancing, matrices réécrites chaque frame', counts: COUNTS, build: instanced, options: { moving: true } },
  { id: 'skinned', label: 'personnages skinnés animés', counts: [50, 200, 800], build: skinnedCrowd, options: {} },
  { id: 'lights-shadows', label: '3 lumières projetantes', counts: COUNTS, build: lightsAndShadows, options: {} },
  { id: 'raycast', label: `picking, ${RAYS_PER_FRAME} rayons/frame`, counts: COUNTS, build: pickable, options: {} },
  { id: 'studio-scene', label: 'scène représentative du studio', counts: [420], build: studioLike, options: {} },
]

export function buildCase(id, count, texture) {
  const found = CASES.find(one => one.id === id)
  if (!found) throw new Error(`scénario inconnu : ${id}`)
  return found.build(count, { ...found.options, texture })
}

export { checker }
