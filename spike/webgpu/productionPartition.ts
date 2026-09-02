import {
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  Vector3,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type Sphere,
} from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneState } from '@/engines/scene/sceneState'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { comparePixels, mean, median, nextFrame, pixelsOf, round, since, tally, top } from './benchShared'
import { centresOf, DEFAULT_PLAN, openWorld, spanFor } from './openWorld'
import { trajectoriesFor } from './trajectories'

/**
 * C5-P1 : le flag de PRODUCTION mesuré, `off` contre `grid`.
 *
 * 🛑 Ce banc ne réimplémente rien. Il monte le vrai `SceneRenderer` des deux côtés du flag et
 * mesure la fenêtre du § 1 de C5-B2 : `gl.render` de la passe couleur, hors ombre et hors
 * enveloppe studio. `partitionBench.ts` mesure des maquettes ; celui-ci mesure le produit, et les
 * deux sont nécessaires — les onze modules `fake*` du banc MCP ont menti douze fois.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
const WARMUP = 10

const EYE = new Vector3()

type Numbers = Record<string, number | string | null>

function hostOf(): HTMLDivElement {
  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  stage.replaceChildren()
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)
  return host
}

/** Le milieu des corps, où la caméra se pose : une vue prise DANS le niveau, jamais du dehors. */
function middleOf(state: SceneState): Point {
  const centres = centresOf(state)
  const count = centres.length / 3
  const middle = { x: 0, y: 2, z: 0 }
  for (let at = 0; at < count; at += 1) {
    middle.x += (centres[at * 3] ?? 0) / count
    middle.z += (centres[at * 3 + 2] ?? 0) / count
  }
  return middle
}

/**
 * Là où le banc de spike se tient : `rest` de `trajectoriesFor`, à `-span * 0,6`, hauteur d'yeux.
 * Le centre du monde et ce point sont à 1 138 unités l'un de l'autre — comparer 397 appels à 244
 * sans le même point de vue ne compare rien.
 */
const spikePose = (count: number): { position: Point; target: Point } => {
  const pose = trajectoriesFor({
    span: spanFor(count),
    far: 500,
    seed: DEFAULT_PLAN.seed,
    boundaryAt: 347.851,
  })[0]?.poseAt(0)
  if (!pose) throw new Error('no trajectory to stand on')
  return pose
}

type Point = { x: number; y: number; z: number }

/** Un corps de plus, posé près de la caméra : l'ajout dont on veut le prix. */
const withOneAdded = (state: SceneState, at: Point): SceneState => ({
  ...state,
  nodes: [
    ...state.nodes,
    {
      ...meshNode('added_body'),
      transform: {
        position: { x: at.x + 3, y: 1, z: at.z + 3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
})

const withoutTheLast = (state: SceneState): SceneState => ({
  ...state,
  nodes: state.nodes.slice(0, -1),
})

/**
 * Ce que la scène TIENT, et ce qu'une frame en parcourt : `updateMatrixWorld` descend dans tout,
 * visible ou non, alors que `projectObject` s'arrête à un `visible` faux. Un écart de CPU qui ne
 * s'explique ni par les appels ni par les instances se lit ici.
 */
function shapeOf(renderer: SceneRenderer): {
  cellsHeld: number
  cellsDrawn: number
  meshes: number
  walked: number
  thinCalls: number
  thinInstances: number
} {
  const scene: Object3D = renderer['viewport'].scene
  let cellsHeld = 0
  let cellsDrawn = 0
  for (const child of scene.children) {
    if (!(child instanceof Group)) continue
    cellsHeld += 1
    if (child.visible) cellsDrawn += 1
  }
  let meshes = 0
  let walked = 0
  // Ce que l'étape 3 aurait à reprendre : un appel qui ne porte qu'une poignée d'instances coûte
  // son prix fixe pour presque rien. Compté sur ce qui est DANS la scène, donc dessiné.
  let thinCalls = 0
  let thinInstances = 0
  scene.traverse(object => {
    walked += 1
    if (!(object instanceof InstancedMesh)) return
    meshes += 1
    if (object.count >= 16) return
    thinCalls += 1
    thinInstances += object.count
  })
  return { cellsHeld, cellsDrawn, meshes, walked, thinCalls, thinInstances }
}

/**
 * D'où viennent les appels de dessin : ceux du REGROUPEMENT, et ceux du mobilier d'atelier que la
 * scène du studio porte et que le banc de spike n'a pas — repères de lampe, aides, marqueurs.
 *
 * Le mobilier se mesure en éteignant ce que la stratégie dessine, jamais l'inverse : `drawn()` est
 * la seule liste qui nomme exactement ses meshes, des deux côtés du flag.
 */
function decompose(
  scene: Object3D,
  camera: PerspectiveCamera,
  drawn: readonly Mesh[],
  draw: () => { calls: number },
): {
  workshopCalls: number
  groupCalls: number
  inFrustum: number
  standing: number
  cellsInFrustum: number
  callsBeyondFar: number
  cellsBeyondFar: number
} {
  const calls = draw().calls
  EYE.copy(camera.position)

  const held = drawn.map(mesh => mesh.visible)
  for (const mesh of drawn) mesh.visible = false
  const workshopCalls = draw().calls
  for (const [at, mesh] of drawn.entries()) mesh.visible = held[at] ?? true

  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  )
  let inFrustum = 0
  let standing = 0
  let beyondFar = 0
  const cells = new Set<Object3D>()
  const far = new Set<Object3D>()
  for (const mesh of drawn) {
    if (!reaches(mesh, scene)) continue
    standing += 1
    if (!frustum.intersectsObject(mesh)) continue
    inFrustum += 1
    const cell = mesh.parent ?? mesh
    cells.add(cell)
    // Ce que la zone laisse entrer et que le plan lointain condamne : une cellule dont le point
    // le plus proche est déjà au-delà de `far` ne peut montrer aucune de ses instances, mais sa
    // sphère englobante mord encore le frustum, donc three la dessine.
    if (nearestOf(mesh) <= camera.far) continue
    beyondFar += 1
    far.add(cell)
  }
  return {
    workshopCalls,
    groupCalls: calls - workshopCalls,
    inFrustum,
    standing,
    cellsInFrustum: cells.size,
    callsBeyondFar: beyondFar,
    cellsBeyondFar: far.size,
  }
}

/** La distance du point le plus proche de ce que ce mesh dessine, depuis la caméra. */
function nearestOf(mesh: Mesh): number {
  const sphere = (mesh as unknown as { boundingSphere: Sphere | null }).boundingSphere
  if (!sphere) return 0
  return Math.max(0, EYE.distanceTo(sphere.center) - sphere.radius)
}

/** Whether the walk of the scene still reaches it — a cell out of the zone has left it. */
function reaches(mesh: Object3D, scene: Object3D): boolean {
  for (let at: Object3D | null = mesh; at; at = at.parent) if (at === scene) return true
  return false
}

/**
 * Les pixels qui diffèrent, en COMPTE et en PLACE : une part arrondie à quatre décimales cache
 * 71 pixels, et deux pixels côte à côte sur une couture ne disent pas la même chose que deux
 * pixels au bord d'une silhouette.
 */
function differing(
  one: ImageData,
  other: ImageData,
): { pixels: number; worst: number; spots: string[] } {
  let pixels = 0
  let worst = 0
  const spots: string[] = []
  for (let at = 0; at < one.data.length; at += 4) {
    const delta =
      Math.abs((one.data[at] ?? 0) - (other.data[at] ?? 0)) +
      Math.abs((one.data[at + 1] ?? 0) - (other.data[at + 1] ?? 0)) +
      Math.abs((one.data[at + 2] ?? 0) - (other.data[at + 2] ?? 0))
    if (delta === 0) continue
    pixels += 1
    if (delta > worst) worst = delta
    if (spots.length < 8) {
      const pixel = at / 4
      const here = [...one.data.slice(at, at + 3)].join(',')
      const there = [...other.data.slice(at, at + 3)].join(',')
      spots.push(`${pixel % one.width},${Math.floor(pixel / one.width)} ${here} vs ${there}`)
    }
  }
  return { pixels, worst, spots }
}

type Shot = { numbers: Numbers; pixels: ImageData }

async function measureOne(
  mode: PartitionMode,
  count: number,
  far: number,
  cycles: number,
  /** Zone OUVERTE : la partition regroupe, mais ne retire aucune cellule. Le contrôle du § pixels. */
  openZone = false,
): Promise<Shot> {
  const host = hostOf()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    partition: mode,
    loadModel: async () => new Group(),
  })
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  // Couleur seule : c'est la fenêtre du § 1, et la passe d'ombre est un tout autre chantier.
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: false })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  const state = openWorld({ ...DEFAULT_PLAN, count })
  const openedAt = performance.now()
  renderer.apply(state)
  const applyMs = round(performance.now() - openedAt)

  const middle = middleOf(state)
  const stands =
    QUERY.get('pose') === 'spike'
      ? spikePose(count)
      : { position: middle, target: { x: middle.x + 1, y: middle.y, z: middle.z } }
  renderer.placeView(stands)
  const camera: PerspectiveCamera = renderer['viewport'].perspective
  camera.far = far
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)

  const gl = renderer['viewport'].gl
  const scene = renderer['viewport'].scene
  if (!gl) throw new Error('the engine mounted no renderer')
  const context = gl.getContext()
  const timer: GlTimer | null =
    context instanceof WebGL2RenderingContext ? createGlTimer(context) : null
  // `as` : la stratégie de dessin est privée par construction, et c'est elle qu'on mesure.
  const groups = renderer['instances'] as {
    follow?: (camera: PerspectiveCamera | null) => boolean
    drawn: () => readonly Mesh[]
  }

  const draw = (): { submitMs: number; followMs: number; matrixMs: number; calls: number; instances: number; triangles: number } => {
    const followAt = performance.now()
    groups.follow?.(openZone ? null : camera)
    const followMs = performance.now() - followAt
    // La marche des matrices À PART : `updateMatrixWorld` descend dans tout, `visible` ou non,
    // et c'est le seul poste qui suive le nombre de meshes plutôt que celui d'appels.
    const matrixAt = performance.now()
    scene.updateMatrixWorld()
    const matrixMs = performance.now() - matrixAt
    const before = tally()
    timer?.begin()
    const submitAt = performance.now()
    gl.render(scene, camera)
    const submitMs = performance.now() - submitAt
    timer?.end()
    return { submitMs, followMs, matrixMs, ...since(before) }
  }

  await nextFrame()
  for (let frame = 0; frame < WARMUP; frame += 1) {
    draw()
    await nextFrame()
  }
  timer?.collect()

  const submits: number[] = []
  const follows: number[] = []
  const matrices: number[] = []
  const gpu: number[] = []
  let last = draw()
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    last = draw()
    submits.push(last.submitMs)
    follows.push(last.followMs)
    matrices.push(last.matrixMs)
    await nextFrame()
    gpu.push(...(timer?.collect() ?? []))
  }

  // 🛑 Dans la FOULÉE du dessin : sans `preserveDrawingBuffer`, une frame qui passe vide le
  // tampon et l'image revient blanche — trois captures blanches ont déjà été lues « 0 pixel ».
  draw()
  const pixels = pixelsOf(canvas)

  const shape = shapeOf(renderer)
  const split = decompose(scene, camera, groups.drawn(), draw)

  // Le prix d'un changement de document : ce que la partition doit rendre en n'invalidant que
  // les cellules touchées. Les états sont composés AVANT le chronomètre.
  const added = withOneAdded(state, middle)
  const addMs: number[] = []
  const dropMs: number[] = []
  for (let pass = 0; pass < 5; pass += 1) {
    const startedAdd = performance.now()
    renderer.apply(added)
    addMs.push(performance.now() - startedAdd)
    const startedDrop = performance.now()
    renderer.apply(withoutTheLast(added))
    dropMs.push(performance.now() - startedDrop)
  }

  timer?.dispose()
  renderer.dispose()

  return {
    pixels,
    numbers: {
      mode,
      count,
      far,
      nodes: state.nodes.length,
      applyMs,
      submitMeanMs: round(mean(submits)),
      submitMedianMs: round(median(submits)),
      submitPeakMs: round(top(submits)),
      followMeanMs: round(mean(follows)),
      matrixMeanMs: round(mean(matrices)),
      gpuMs: gpu.length > 0 ? round(median(gpu)) : null,
      calls: last.calls,
      instances: last.instances,
      triangles: last.triangles,
      ...shape,
      ...split,
      addMedianMs: round(median(addMs)),
      dropMedianMs: round(median(dropMs)),
    },
  }
}

export type Step = { mode: PartitionMode; count: number; phase: string }

export async function runProductionPartition(
  onProgress?: (step: Step) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const counts = (QUERY.get('counts') ?? '500000').split(',').map(Number)
  const far = Number(QUERY.get('far') ?? 500)
  const cycles = Number(QUERY.get('cycles') ?? 8)
  const results: unknown[] = []
  const failures: unknown[] = []

  for (const count of counts) {
    const shots = new Map<string, Shot>()
    // 🛑 `off` DEUX fois : une comparaison sans contrôle ne prouve rien. Deux moteurs, deux
    // contextes et deux ordres de dessin donnent déjà un écart, et sans ce témoin on le mettrait
    // sur le dos de la partition.
    for (const [label, mode, openZone] of [
      ['off', 'off', false],
      ['witness', 'off', false],
      ['grid', 'grid', false],
      ['gridWide', 'grid', true],
    ] as [string, PartitionMode, boolean][]) {
      try {
        onProgress?.({ mode, count, phase: `${label} · ${count}` })
        shots.set(label, await measureOne(mode, count, far, cycles, openZone))
      } catch (error) {
        // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
        failures.push({ label, count, error: String((error as { stack?: string }).stack ?? error) })
      }
    }
    const off = shots.get('off')
    const witness = shots.get('witness')
    const grid = shots.get('grid')
    for (const [label, shot] of shots) results.push({ label, ...shot.numbers })
    if (off && witness) {
      results.push({
        mode: 'pixels',
        against: 'off',
        count,
        far,
        ...comparePixels(off.pixels, witness.pixels, 0),
        ...differing(off.pixels, witness.pixels),
      })
    }
    const wide = shots.get('gridWide')
    if (off && wide) {
      // Ce que le REGROUPEMENT seul change, zone ouverte : ce qui reste au-delà vient de la zone.
      results.push({
        mode: 'pixels',
        against: 'gridWide',
        count,
        far,
        ...comparePixels(off.pixels, wide.pixels, 0),
        ...differing(off.pixels, wide.pixels),
      })
    }
    if (off && grid) {
      // Le juge du lot : la même vue, les mêmes pixels. Un seuil de 0 — « identique au pixel ».
      results.push({
        mode: 'pixels',
        against: 'grid',
        count,
        far,
        ...comparePixels(off.pixels, grid.pixels, 0),
        ...differing(off.pixels, grid.pixels),
      })
    }
    ;(globalThis as { __partial?: unknown }).__partial = { results, failures }
  }
  return { results, failures }
}
