import { Group, InstancedMesh, type Mesh, type Object3D, type PerspectiveCamera } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SCENE_TEMPLATE_IDS, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import { sceneFromTemplate } from '@/engines/scene/sceneTemplates'
import { addNode, moveNodes, removeNode, setTransform } from '@/engines/scene/commands'
import { meshNode, transformAt } from '@/engines/scene/nodeFactory'
import type { Command } from '@/engines/core/history'
import { nodeById, type NodeMove, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { differing, hostOf, mean, median, nextFrame, pixelsOf, round, since, tally, top } from './benchShared'
import { DEFAULT_PLAN, openWorld, type Point } from './openWorld'

/**
 * C5-P1 étape 5 : ce que la partition par défaut change sur les scènes que le STUDIO produit, et
 * non sur un monde de banc. Les gestes d'édition passent par les vraies commandes du studio, dont
 * l'`undo` est leur propre `revert`.
 */

const QUERY = new URLSearchParams(location.search)
const WARMUP = 10

type Numbers = Record<string, number | string | null>

type Weight = { template: SceneTemplateId; nodes: number; meshes: number; groups: number }

/** Ce qu'un modèle pèse, avant d'en mesurer aucun : c'est ce compte qui choisit les deux lourdes. */
function weigh(id: SceneTemplateId): Weight {
  const held = stateOf(id)
  let meshes = 0
  let groups = 0
  for (const node of held.nodes) {
    if (node.type === 'mesh') meshes += 1
    else if (node.type === 'group') groups += 1
  }
  return { template: id, nodes: held.nodes.length, meshes, groups }
}

type Mounted = {
  renderer: SceneRenderer
  canvas: HTMLCanvasElement
  scene: Object3D
  timer: GlTimer | null
  groups: Groups
  objects: Map<string, Object3D>
  draw: () => Frame
  dispose: () => void
}

type Groups = {
  follow?: (camera: PerspectiveCamera | null, cast?: unknown) => boolean
  moved: (ids: Iterable<string>, objectOf: (id: string) => Object3D | undefined) => boolean
  drawn: () => readonly Mesh[]
  stats?: () => { nodesVisited: number; cellsReturned: number; cells: number }
}

type Frame = {
  submitMs: number
  followMs: number
  calls: number
  instances: number
  triangles: number
}

/** Au niveau module : nées dans `mount`, elles retiendraient son contexte via le cache du moteur. */
const NOTHING = (): void => {}
const NO_MODEL = async (): Promise<Group> => new Group()

function mount(mode: PartitionMode, state: SceneState): Mounted {
  const host = hostOf()
  const renderer = new SceneRenderer({
    onSelect: NOTHING,
    onTransform: NOTHING,
    partition: mode,
    loadModel: NO_MODEL,
  })
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: QUERY.get('shadows') !== 'off' })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  renderer.apply(state)
  // Le cadrage de la scène elle-même : une pose écrite à la main cadrerait autrement d'un modèle
  // à l'autre, et c'est la MÊME vue des deux côtés du flag qui rend les pixels comparables.
  if (QUERY.get('pose') === 'inside') renderer.placeView(insideOf(state))
  else renderer.frameContents()

  // `as` : la stratégie, les objets et le contexte sont privés par construction, et c'est eux
  // qu'on mesure.
  const camera: PerspectiveCamera = renderer['viewport'].perspective
  const scene: Object3D = renderer['viewport'].scene
  const gl = renderer['viewport'].gl
  if (!gl) throw new Error('the engine mounted no renderer')
  const groups = renderer['instances'] as Groups
  const objects = renderer['objects'] as Map<string, Object3D>
  const context = gl.getContext()
  const timer: GlTimer | null =
    context instanceof WebGL2RenderingContext ? createGlTimer(context) : null

  const draw = (): Frame => {
    const followAt = performance.now()
    groups.follow?.(camera, renderer['shadowThrow'])
    const followMs = performance.now() - followAt
    scene.updateMatrixWorld()
    const before = tally()
    timer?.begin()
    const submitAt = performance.now()
    gl.render(scene, camera)
    const submitMs = performance.now() - submitAt
    timer?.end()
    return { submitMs, followMs, ...since(before) }
  }

  return {
    renderer,
    canvas,
    scene,
    timer,
    groups,
    objects,
    draw,
    dispose: () => {
      timer?.dispose()
      renderer.dispose()
    },
  }
}

/** Le milieu des corps, où une caméra se pose DANS le niveau plutôt que de le cadrer du dehors. */
function insideOf(state: SceneState): { position: Point; target: Point } {
  const middle = { x: 0, y: 2, z: 0 }
  let count = 0
  for (const node of state.nodes) {
    if (node.type !== 'mesh') continue
    count += 1
    middle.x += node.transform.position.x
    middle.z += node.transform.position.z
  }
  if (count > 0) {
    middle.x /= count
    middle.z /= count
  }
  return { position: middle, target: { x: middle.x + 1, y: middle.y, z: middle.z } }
}

/** Ce que la scène TIENT, et ce que la partition en retient. */
function shapeOf(held: Mounted): Numbers {
  let cellsHeld = 0
  let cellsDrawn = 0
  for (const child of held.scene.children) {
    if (!(child instanceof Group)) continue
    cellsHeld += 1
    if (child.visible) cellsDrawn += 1
  }
  let meshes = 0
  let submitted = 0
  held.scene.traverse(object => {
    if (!(object instanceof InstancedMesh)) return
    meshes += 1
    if (object.visible) submitted += object.count
  })
  const walked = held.groups.stats?.()
  return {
    cellsHeld,
    cellsDrawn,
    instancedMeshes: meshes,
    submittedInstances: submitted,
    grouped: held.groups.drawn().length,
    nodesVisited: walked?.nodesVisited ?? 0,
    cellsKnown: walked?.cells ?? 0,
  }
}

async function measureOne(mode: PartitionMode, id: string): Promise<Shot> {
  const state = stateOf(id)
  const openedAt = performance.now()
  const held = mount(mode, state)
  const applyMs = round(performance.now() - openedAt)

  await nextFrame()
  for (let frame = 0; frame < WARMUP; frame += 1) {
    held.draw()
    await nextFrame()
  }
  held.timer?.collect()

  const cycles = Number(QUERY.get('cycles') ?? 8)
  const submits: number[] = []
  const follows: number[] = []
  const gpu: number[] = []
  let last: Frame | undefined
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    last = held.draw()
    submits.push(last.submitMs)
    follows.push(last.followMs)
    await nextFrame()
    gpu.push(...(held.timer?.collect() ?? []))
  }

  // 🛑 Dans la FOULÉE du dessin : sans `preserveDrawingBuffer` une frame qui passe vide le tampon
  // et l'image revient blanche — trois captures blanches ont déjà été lues « 0 pixel ».
  const shown = held.draw()
  const pixels = pixelsOf(held.canvas)
  const shape = shapeOf(held)
  held.dispose()

  return {
    pixels,
    numbers: {
      mode,
      template: id,
      nodes: state.nodes.length,
      applyMs,
      submitMeanMs: round(mean(submits)),
      submitMedianMs: round(median(submits)),
      submitPeakMs: round(top(submits)),
      followMeanMs: round(mean(follows)),
      gpuMs: gpu.length > 0 ? round(median(gpu)) : null,
      calls: (last ?? shown).calls,
      instances: (last ?? shown).instances,
      triangles: (last ?? shown).triangles,
      ...shape,
    },
  }
}

type Shot = { numbers: Numbers; pixels: ImageData }

/**
 * La scène qu'un nom désigne : un modèle du studio, ou — sous `world:<n>` — le monde du banc, seul
 * endroit du dépôt où un groupe passe le plancher d'instanciation. Tenue : six montages la
 * demandent, et bâtir 500 000 corps six fois pèse plus lourd que ce que le banc mesure.
 */
const BUILT = new Map<string, SceneState>()

function stateOf(id: string): SceneState {
  const known = BUILT.get(id)
  if (known) return known
  const built = id.startsWith('world:')
    ? openWorld({ ...DEFAULT_PLAN, count: Number(id.slice('world:'.length)) })
    : sceneFromTemplate(id as SceneTemplateId)
  BUILT.set(id, built)
  return built
}

/** Le corps qu'un ajout pose : au milieu du niveau, à hauteur d'homme, pour qu'il se VOIE. */
const addedBody = (): SceneNode =>
  meshNode({ kind: 'box', width: 2, height: 2, depth: 2 }, { transform: transformAt({ x: 0, y: 1, z: 0 }) })

/**
 * Les cinq gestes d'édition, joués dans l'ordre sur un moteur monté — chacun rend son image.
 *
 * Les commandes sont celles du studio, et l'`undo` est leur propre `revert` : rejouer un état
 * mémorisé à la main prouverait que le banc sait revenir en arrière, pas que le studio le sait.
 */
async function editEvery(mode: PartitionMode, id: string): Promise<Edits> {
  let state = stateOf(id)
  const held = mount(mode, state)
  await nextFrame()
  for (let frame = 0; frame < WARMUP; frame += 1) {
    held.draw()
    await nextFrame()
  }

  const shots = new Map<string, ImageData>()
  const numbers: Numbers[] = []
  const shoot = (step: string): void => {
    const frame = held.draw()
    shots.set(step, pixelsOf(held.canvas))
    numbers.push({ mode, template: id, step, calls: frame.calls, instances: frame.instances })
  }
  const run = (step: string, command: Command<SceneState>): Command<SceneState> => {
    state = command.apply(state)
    held.renderer.apply(state)
    shoot(step)
    return command
  }

  shoot('opened')

  const body = addedBody()
  const added = run('added', addNode(body))

  // Le déplacement d'UN objet, par la commande que le champ de l'inspecteur écrit.
  run('movedOne', setTransform(body.id, transformAt({ x: 4, y: 1, z: -3 })))

  // 🛑 Le glisser MULTI-SÉLECTION passe par `moved`, jamais par un `apply` : entre le début et la
  // fin d'un geste le studio écrit les matrices en place, et c'est ce chemin-là qui décide si un
  // corps est dessiné là où le pointeur l'a laissé.
  const dragged: string[] = []
  for (const node of state.nodes) {
    if (node.type !== 'mesh') continue
    dragged.push(node.id)
    if (dragged.length === 6) break
  }
  for (const nodeId of dragged) {
    const object = held.objects.get(nodeId)
    if (!object) continue
    object.position.x += 1.5
    object.position.y += 0.5
    object.updateMatrixWorld(true)
  }
  held.groups.moved(dragged, nodeId => held.objects.get(nodeId))
  shoot('dragged')

  // 🛑 UNE commande pour tout le glisser, ce que `onTransform` écrit : six `setTransform` feraient
  // six entrées d'historique et six copies du tableau, ce qu'aucun relâchement du studio ne fait.
  const moves: NodeMove[] = []
  for (const nodeId of dragged) {
    const object = held.objects.get(nodeId)
    const node = nodeById(state, nodeId)
    if (!object || !node) continue
    moves.push({
      id: nodeId,
      transform: {
        ...node.transform,
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
      },
    })
  }
  run('released', moveNodes(moves))

  run('removed', removeNode(body.id))

  // L'undo de l'AJOUT, remonté à travers ce qui l'a suivi : c'est le geste que ⌘Z rejoue.
  state = added.revert(state)
  held.renderer.apply(state)
  shoot('undone')

  held.dispose()
  return { shots, numbers }
}

type Edits = { shots: Map<string, ImageData>; numbers: Numbers[] }

export type Step = { phase: string }

/** `off` DEUX fois : deux moteurs, deux contextes et deux ordres de dessin donnent déjà un écart,
 * et sans ce témoin on le mettrait sur le dos de la partition. */
const RUNS: readonly [string, PartitionMode][] = [
  ['off', 'off'],
  ['witness', 'off'],
  ['grid', 'grid'],
]

/** Les trois bras d'une campagne, chacun rendu sous son étiquette — un échec est noté, pas jeté. */
async function eachRun<T>(
  id: string,
  phase: string,
  onProgress: ((step: Step) => void) | undefined,
  failures: unknown[],
  take: (mode: PartitionMode) => Promise<T>,
): Promise<Map<string, T>> {
  const held = new Map<string, T>()
  for (const [label, mode] of RUNS) {
    try {
      onProgress?.({ phase: `${phase}${label} · ${id}` })
      held.set(label, await take(mode))
    } catch (error) {
      // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
      failures.push({ label, phase, id, error: String((error as { stack?: string }).stack ?? error) })
    }
  }
  return held
}

export async function runProductLevel(
  onProgress?: (step: Step) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const results: unknown[] = []
  const failures: unknown[] = []

  // 🛑 Les candidates AVANT toute mesure : « la plus lourde » est un compte, pas une intuition.
  const weights = SCENE_TEMPLATE_IDS.map(weigh)
  for (const one of weights) results.push({ mode: 'weight', ...one })
  const asked = QUERY.get('templates')
  const heaviest: string[] = asked
    ? asked.split(',')
    : [...weights]
        .sort((one, other) => other.nodes - one.nodes)
        .slice(0, 2)
        .map(one => one.template)

  for (const id of heaviest) {
    const shots = await eachRun(id, '', onProgress, failures, mode => measureOne(mode, id))
    for (const [label, shot] of shots) results.push({ label, ...shot.numbers })
    const off = shots.get('off')
    for (const label of ['witness', 'grid']) {
      const other = shots.get(label)
      if (off && other) {
        results.push({ mode: 'pixels', template: id, against: label, ...differing(off.pixels, other.pixels) })
      }
    }

    const edits = await eachRun(id, 'édition ', onProgress, failures, mode => editEvery(mode, id))
    const base = edits.get('off')
    for (const one of edits.values()) results.push(...one.numbers)
    for (const label of ['witness', 'grid']) {
      const other = edits.get(label)
      if (!base || !other) continue
      for (const [step, image] of base.shots) {
        const against = other.shots.get(step)
        if (!against) continue
        results.push({ mode: 'editPixels', template: id, against: label, step, ...differing(image, against) })
      }
    }
    ;(globalThis as { __partial?: unknown }).__partial = { results, failures }
  }
  return { results, failures }
}
