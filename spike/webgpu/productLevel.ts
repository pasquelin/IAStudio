import { Group, InstancedMesh, type Mesh, type Object3D, type PerspectiveCamera } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SCENE_TEMPLATE_IDS, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import { sceneFromTemplate } from '@/engines/scene/sceneTemplates'
import { addNode, removeNode, setTransform } from '@/engines/scene/commands'
import { meshNode, transformAt } from '@/engines/scene/nodeFactory'
import type { Command } from '@/engines/core/history'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { mean, median, nextFrame, pixelsOf, round, since, tally, top } from './benchShared'
import { DEFAULT_PLAN, openWorld } from './openWorld'

/**
 * C5-P1 étape 5 : ce que la partition par défaut change sur les scènes que le STUDIO produit —
 * les neuf modèles de `sceneTemplates`, et non un monde synthétique de banc.
 *
 * 🛑 Il monte le vrai `SceneRenderer` des deux côtés du flag et joue les gestes d'édition par
 * les vraies commandes de `engines/scene/commands`, dont l'`undo` est leur propre `revert`.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
const WARMUP = 10

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

/** Ce qu'un modèle pèse, avant d'en mesurer aucun : c'est ce compte qui choisit les deux lourdes. */
function weigh(id: SceneTemplateId): Numbers {
  const state = sceneFromTemplate(id)
  return {
    template: id,
    nodes: state.nodes.length,
    meshes: state.nodes.filter(node => node.type === 'mesh').length,
    groups: state.nodes.filter(node => node.type === 'group').length,
  }
}

type Mounted = {
  renderer: SceneRenderer
  canvas: HTMLCanvasElement
  camera: PerspectiveCamera
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

function mount(mode: PartitionMode, state: SceneState): Mounted {
  const host = hostOf()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    partition: mode,
    loadModel: async () => new Group(),
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
    camera,
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

type Point = { x: number; y: number; z: number }

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

/**
 * Les pixels qui diffèrent, en COMPTE et en PLACE — une part arrondie cache soixante-et-onze, et
 * les TEINTES disent si un corps manque ou si deux voisines se départagent autrement.
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
  let last = held.draw()
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    last = held.draw()
    submits.push(last.submitMs)
    follows.push(last.followMs)
    await nextFrame()
    gpu.push(...(held.timer?.collect() ?? []))
  }

  // 🛑 Dans la FOULÉE du dessin : sans `preserveDrawingBuffer` une frame qui passe vide le tampon
  // et l'image revient blanche — trois captures blanches ont déjà été lues « 0 pixel ».
  held.draw()
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
      calls: last.calls,
      instances: last.instances,
      triangles: last.triangles,
      ...shape,
    },
  }
}

type Shot = { numbers: Numbers; pixels: ImageData }

/**
 * La scène qu'un nom désigne : un modèle du studio, ou — sous `world:<n>` — le monde du banc, seul
 * endroit du dépôt où un groupe passe le plancher d'instanciation et où la partition a de quoi
 * mordre. Les modèles ne portent que 32 corps tous différents : elle n'y regroupe rien.
 */
function stateOf(id: string): SceneState {
  const world = id.startsWith('world:') ? Number(id.slice('world:'.length)) : null
  if (world !== null) return openWorld({ ...DEFAULT_PLAN, count: world })
  return sceneFromTemplate(id as SceneTemplateId)
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
  const dragged = state.nodes.filter(node => node.type === 'mesh').slice(0, 6).map(node => node.id)
  for (const nodeId of dragged) {
    const object = held.objects.get(nodeId)
    if (!object) continue
    object.position.x += 1.5
    object.position.y += 0.5
    object.updateMatrixWorld(true)
  }
  held.groups.moved(dragged, nodeId => held.objects.get(nodeId))
  shoot('dragged')

  // Le glisser rendu au document, comme un relâchement le fait : l'état rattrape les matrices.
  for (const nodeId of dragged) {
    const object = held.objects.get(nodeId)
    if (!object) continue
    state = setTransform(nodeId, {
      ...(state.nodes.find(node => node.id === nodeId)?.transform ?? transformAt({ x: 0, y: 0, z: 0 })),
      position: { x: object.position.x, y: object.position.y, z: object.position.z },
    }).apply(state)
  }
  held.renderer.apply(state)
  shoot('released')

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

export async function runProductLevel(
  onProgress?: (step: Step) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const results: unknown[] = []
  const failures: unknown[] = []

  // 🛑 Les candidates AVANT toute mesure : « la plus lourde » est un compte, pas une intuition.
  const weights = SCENE_TEMPLATE_IDS.map(weigh)
  for (const one of weights) results.push({ mode: 'weight', ...one })
  const asked = QUERY.get('templates')
  const heaviest = asked
    ? asked.split(',')
    : [...weights]
        .sort((one, other) => Number(other['nodes']) - Number(one['nodes']))
        .slice(0, 2)
        .map(one => String(one['template']))

  for (const id of heaviest) {
    const shots = new Map<string, Shot>()
    // `off` DEUX fois : deux moteurs, deux contextes et deux ordres de dessin donnent déjà un
    // écart, et sans ce témoin on le mettrait sur le dos de la partition.
    for (const [label, mode] of [
      ['off', 'off'],
      ['witness', 'off'],
      ['grid', 'grid'],
    ] as [string, PartitionMode][]) {
      try {
        onProgress?.({ phase: `${label} · ${id}` })
        shots.set(label, await measureOne(mode, id))
      } catch (error) {
        failures.push({ label, id, error: String((error as { stack?: string }).stack ?? error) })
      }
    }
    for (const [label, shot] of shots) results.push({ label, ...shot.numbers })
    const off = shots.get('off')
    for (const label of ['witness', 'grid']) {
      const other = shots.get(label)
      if (off && other) {
        results.push({ mode: 'pixels', template: id, against: label, ...differing(off.pixels, other.pixels) })
      }
    }

    const edits = new Map<string, Edits>()
    for (const [label, mode] of [
      ['off', 'off'],
      ['witness', 'off'],
      ['grid', 'grid'],
    ] as [string, PartitionMode][]) {
      try {
        onProgress?.({ phase: `édition ${label} · ${id}` })
        edits.set(label, await editEvery(mode, id))
      } catch (error) {
        failures.push({ label: `edit:${label}`, id, error: String((error as { stack?: string }).stack ?? error) })
      }
    }
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
