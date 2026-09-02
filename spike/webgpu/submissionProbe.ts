import { Group, InstancedMesh, Object3D, PerspectiveCamera, WebGLRenderer, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { checker } from './floorScenes.js'
import { mean, median, nextFrame, round } from './benchShared'
import { clockResolution } from './clockProbe'
import { DEFAULT_PLAN, openWorld, spanFor } from './openWorld'
import { bodiesOf } from './worldBodies'
import { regionStrategy } from './partitionStrategies'

/**
 * Q1 de C5-B2 : pourquoi le MÊME témoin coûte 2,76 ms en C5-B0 et 0,448 ms en C5-B1.
 *
 * Les deux bancs disaient mesurer « la passe CPU » du même monde, à la même distance. L'écart est
 * de ×6 et n'est pas du bruit : cette sonde décompose ce que chaque fenêtre contenait, sur la même
 * machine et dans la même page, plutôt que de le déduire.
 */

const WIDTH = 1600
const HEIGHT = 900
const BLOCKS = 12
const FRAMES = 15
const QUERY = new URLSearchParams(location.search)

/** Un bloc de quinze, médiane de douze : la méthode de C5-B0, gardée pour que l'écart soit lisible. */
async function blockOf(run: () => void): Promise<number> {
  const blocks: number[] = []
  for (let block = 0; block < BLOCKS; block += 1) {
    const started = performance.now()
    for (let frame = 0; frame < FRAMES; frame += 1) run()
    blocks.push((performance.now() - started) / FRAMES)
    await nextFrame()
  }
  return round(median(blocks))
}

const countObjects = (root: Object3D): { total: number; instanced: number } => {
  let total = 0
  let instanced = 0
  root.traverse(one => {
    total += 1
    if (one instanceof InstancedMesh) instanced += 1
  })
  return { total, instanced }
}

export async function runSubmissionProbe(): Promise<{ results: unknown[]; failures: unknown[] }> {
  const count = Number(QUERY.get('bodies') ?? 500_000)
  const far = Number(QUERY.get('far') ?? 500)
  const span = spanFor(count)
  const state = openWorld({ ...DEFAULT_PLAN, count })

  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)

  const texture: Texture = checker()
  const studio = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping: 'instanced',
    loadModel: async () => new Group(),
    loadTexture: async () => texture,
  })

  const rows: Record<string, unknown>[] = []
  try {
    studio.prepareOffscreen({ alpha: false, pixelRatio: 1 })
    studio.mount(host)
    studio.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })
    studio.apply(state)

    const camera = studio['viewport'].perspective
    camera.far = far
    camera.updateProjectionMatrix()
    camera.position.set(-span * 0.6, 1.7, 0)
    camera.lookAt(-span * 0.6 + 1, 1.7, 0)
    camera.updateMatrixWorld()
    for (let frame = 0; frame < 20; frame += 1) await nextFrame()

    const gl = studio['viewport'].gl
    const scene = studio['viewport'].scene
    const shape = countObjects(scene)

    // ── ce que C5-B0 appelait « passe CPU », à l'identique
    const withShadow = await blockOf(() => {
      if (gl) gl.shadowMap.needsUpdate = true
      studio.drawFrom(null, 0)
    })
    const colourOnly = await blockOf(() => {
      if (gl) gl.shadowMap.needsUpdate = false
      studio.drawFrom(null, 0)
    })

    // ── et ses morceaux, un par un
    const renderOnly = await blockOf(() => {
      if (!gl) return
      gl.shadowMap.needsUpdate = false
      gl.setRenderTarget(null)
      gl.render(scene, camera)
    })
    const matricesOnly = await blockOf(() => scene.updateMatrixWorld(true))
    // `matrixWorldAutoUpdate` coupé : ce que `render` cesse alors de refaire à chaque frame.
    const held = scene.matrixWorldAutoUpdate
    scene.matrixWorldAutoUpdate = false
    const renderNoMatrices = await blockOf(() => {
      if (!gl) return
      gl.setRenderTarget(null)
      gl.render(scene, camera)
    })
    scene.matrixWorldAutoUpdate = held

    rows.push({
      harness: 'studio (C5-B0)',
      objectsInScene: shape.total,
      instancedMeshes: shape.instanced,
      drawFromWithShadowMs: withShadow,
      drawFromColourOnlyMs: colourOnly,
      glRenderOnlyMs: renderOnly,
      updateMatrixWorldMs: matricesOnly,
      glRenderWithoutMatrixWalkMs: renderNoMatrices,
      bufferWidth: studio['viewport'].canvas?.width ?? 0,
    })
  } finally {
    studio.dispose()
  }

  // ── le harnais de C5-B1 : une scène nue, le même découpage en régions
  const bare = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  bare.setPixelRatio(1)
  bare.setSize(WIDTH, HEIGHT, false)
  host.append(bare.domElement)
  const camera = new PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, far)
  camera.position.set(-span * 0.6, 1.7, 0)
  camera.lookAt(-span * 0.6 + 1, 1.7, 0)
  camera.updateMatrixWorld()

  const { bodies, lots } = bodiesOf(state)
  const witness = regionStrategy(bodies, lots)
  try {
    for (let frame = 0; frame < 20; frame += 1) {
      bare.render(witness.scene, camera)
      await nextFrame()
    }
    const shape = countObjects(witness.scene)
    const renderOnly = await blockOf(() => bare.render(witness.scene, camera))
    const matricesOnly = await blockOf(() => witness.scene.updateMatrixWorld(true))
    rows.push({
      harness: 'nu (C5-B1)',
      objectsInScene: shape.total,
      instancedMeshes: shape.instanced,
      glRenderOnlyMs: renderOnly,
      updateMatrixWorldMs: matricesOnly,
      bufferWidth: bare.domElement.width,
    })
  } finally {
    witness.dispose()
    bare.dispose()
    host.remove()
    texture.dispose()
  }

  return { results: [{ count, far, clock: clockResolution(), harnesses: rows }], failures: [] }
}
