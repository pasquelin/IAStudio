/**
 * Ce que coûtent les SOURCES que le moteur garde dans la scène : N meshes sur une couche que la
 * caméra ne regarde pas, à côté de ce qui les dessine vraiment. Rien n'est dessiné pour elles,
 * mais three les traverse — `updateMatrixWorld` recompose chaque matrice locale à chaque
 * `render`, et `projectObject` visite chaque objet, dans la passe de couleur et dans chaque
 * carte d'ombre.
 *
 * Trois cas, même image à l'écran : sans source · sources à `matrixAutoUpdate` vrai (ce que le
 * moteur fait) · sources à `matrixAutoUpdate` faux. La différence entre le premier et le second
 * est le plancher qu'aucun regroupement ne peut rendre.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'

const WIDTH = 1600
const HEIGHT = 900
const WARMUP = 20
const BLOCKS = 8
const FRAMES = 10
const HIDDEN_LAYER = 2

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))
const median = values => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}
const round = value => Math.round(value * 1000) / 1000

function seeded(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(count, sources) {
  const scene = new Scene()
  scene.background = new Color(0x11131a)
  scene.add(new AmbientLight(0xffffff, 0.4))
  const sun = new DirectionalLight(0xffffff, 2.2)
  sun.position.set(40, 70, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -80
  sun.shadow.camera.right = 80
  sun.shadow.camera.top = 80
  sun.shadow.camera.bottom = -80
  sun.shadow.camera.far = 400
  scene.add(sun)

  const random = seeded(7)
  const reach = Math.ceil(Math.cbrt(count)) * 1.3
  const shapes = [new BoxGeometry(1, 1, 1), new SphereGeometry(0.6, 16, 12), new CylinderGeometry(0.5, 0.5, 1.2, 16)]
  const paints = Array.from({ length: 8 }, (_unused, at) => new MeshStandardMaterial({ color: new Color().setHSL(at / 8, 0.6, 0.55) }))
  const groups = new Map()
  const placements = []
  for (let at = 0; at < count; at++) {
    const shape = at % 3
    const paint = (at * 7) % 8
    const scale = 0.6 + random() * 0.8
    const matrix = new Matrix4().compose(
      new Vector3((random() - 0.5) * 2 * reach, (random() - 0.5) * 2 * reach, (random() - 0.5) * 2 * reach),
      new Quaternion().setFromEuler({ x: random() * 6.28, y: random() * 6.28, z: random() * 6.28, order: 'XYZ', isEuler: true }),
      new Vector3(scale, scale, scale),
    )
    placements.push({ shape, paint, matrix })
    const key = `${shape}|${paint}`
    const held = groups.get(key) ?? []
    held.push(matrix)
    groups.set(key, held)
  }
  for (const [key, matrices] of groups) {
    const [shape, paint] = key.split('|').map(Number)
    const instance = new InstancedMesh(shapes[shape], paints[paint], matrices.length)
    for (const [slot, matrix] of matrices.entries()) instance.setMatrixAt(slot, matrix)
    instance.instanceMatrix.needsUpdate = true
    instance.castShadow = true
    instance.receiveShadow = true
    instance.computeBoundingSphere()
    scene.add(instance)
  }
  if (sources !== 'none') {
    for (const { shape, paint, matrix } of placements) {
      const mesh = new Mesh(shapes[shape], paints[paint])
      matrix.decompose(mesh.position, mesh.quaternion, mesh.scale)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.layers.set(HIDDEN_LAYER)
      if (sources === 'frozen') {
        mesh.updateMatrix()
        mesh.matrixAutoUpdate = false
      }
      scene.add(mesh)
    }
  }

  const camera = new PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, 2000)
  camera.position.set(reach * 1.4, reach * 0.9, reach * 1.9)
  camera.lookAt(0, 0, 0)
  return { scene, camera }
}

export async function runSources(onProgress) {
  const results = []
  const query = new URLSearchParams(location.search)
  const counts = (query.get('counts') ?? '10000,50000').split(',').map(Number)
  for (const count of counts) {
    for (const sources of ['none', 'auto', 'frozen']) {
      onProgress?.({ count, sources })
      const stage = document.querySelector('#stage')
      stage.replaceChildren()
      const canvas = document.createElement('canvas')
      canvas.width = WIDTH
      canvas.height = HEIGHT
      canvas.style.width = `${WIDTH / 2}px`
      canvas.style.height = `${HEIGHT / 2}px`
      stage.append(canvas)
      const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(1)
      renderer.setSize(WIDTH, HEIGHT, false)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = PCFShadowMap
      const { scene, camera } = build(count, sources)

      for (let frame = 0; frame < WARMUP; frame++) {
        renderer.render(scene, camera)
        await nextFrame()
      }
      const cpu = []
      for (let block = 0; block < BLOCKS; block++) {
        const started = performance.now()
        for (let frame = 0; frame < FRAMES; frame++) renderer.render(scene, camera)
        cpu.push((performance.now() - started) / FRAMES)
        await nextFrame()
      }
      renderer.info.autoReset = false
      renderer.info.reset()
      renderer.render(scene, camera)
      results.push({ count, sources, cpuRenderMs: round(median(cpu)), drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles })

      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose()
      })
      renderer.dispose()
      globalThis.__partial = { results, failures: [] }
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }
  return { results, failures: [] }
}
