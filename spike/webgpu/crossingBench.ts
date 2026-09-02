import {
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { Component } from '@shared/domain/component'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import type { MeshNode, SceneState } from '@/engines/scene/sceneState'
import { comparePixels, mean, nextFrame, pixelsOf, round, top } from './benchShared'
import { DEFAULT_PLAN, openWorld } from './openWorld'
import { CELL_SIZE } from '@/engines/scene/worldPartition'

/**
 * C5-P1, étape 4 mesurée sur un VRAI déplacement : 1 % des corps à 1 m par frame — la vitesse
 * `run` de C5-B0 — sur 300 frames, soit 300 unités, plus d'une cellule de 256.
 *
 * 🛑 Le décor précédent déplaçait de 0,4 unité en tout : il ne mesurait rien de ce que la couche
 * doit rendre. Ce qui se lit ici : est-ce qu'un corps ayant quitté sa cellule est encore dessiné
 * au bon endroit, ce que devient la boîte de sa cellule, et ce que la couche coûte.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
const FRAMES = Number(QUERY.get('frames') ?? 300)
/** La vitesse `run` de C5-B0 : 1 m par frame, soit 120 m/s à 120 Hz. Le pire cas assumé. */
const SPEED = 1

type Numbers = Record<string, number | string | boolean | null>

const MOVES: Component = { type: 'Movement' }

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

/** Le monde, avec une part de corps qui DÉCLARENT qu'ils bougent — ou personne, en repli. */
function worldOf(count: number, share: number, declare: boolean): SceneState {
  const built = openWorld({ ...DEFAULT_PLAN, count })
  if (!declare || share <= 0) return built
  const every = Math.max(1, Math.round(1 / share))
  let at = 0
  return {
    ...built,
    nodes: built.nodes.map(node => {
      if (node.type !== 'mesh' || !node.id.startsWith('prop')) return node
      at += 1
      return at % every === 0 ? ({ ...node, components: [MOVES] } as MeshNode) : node
    }),
  }
}

/** Ce que le rendu atteint vraiment : l'objet visible, et chaque groupe dont il pend avec lui. */
function isDrawn(mesh: Object3D, scene: Object3D): boolean {
  for (let at: Object3D | null = mesh; at && at !== scene; at = at.parent) {
    if (!at.visible) return false
    if (at.parent === null) return false
  }
  return true
}

/** À quelle distance la plus proche des abscisses dessinées se tient de celle-ci. */
function nearestTo(sorted: readonly number[], want: number): number {
  let low = 0
  let high = sorted.length - 1
  let best = Infinity
  while (low <= high) {
    const middle = (low + high) >> 1
    const at = sorted[middle] ?? 0
    best = Math.min(best, Math.abs(at - want))
    if (at < want) low = middle + 1
    else high = middle - 1
  }
  return best
}

/** La boîte d'une cellule, mesurée sur ce qu'elle dessine : c'est elle que le rejet teste. */
function widestCell(scene: Object3D): number {
  let widest = 0
  for (const child of scene.children) {
    if (!(child instanceof Group)) continue
    let low = Infinity
    let high = -Infinity
    for (const mesh of child.children) {
      if (!(mesh instanceof InstancedMesh) || !mesh.boundingSphere) continue
      low = Math.min(low, mesh.boundingSphere.center.x - mesh.boundingSphere.radius)
      high = Math.max(high, mesh.boundingSphere.center.x + mesh.boundingSphere.radius)
    }
    if (high - low > widest) widest = high - low
  }
  return round(widest)
}

type Shot = { numbers: Numbers; pixels: ImageData }

async function measureOne(
  mode: PartitionMode,
  count: number,
  share: number,
  declare: boolean,
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
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: false })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  const state = worldOf(count, share, declare)
  renderer.apply(state)
  renderer.placeView({ position: { x: 0, y: 2, z: 0 }, target: { x: 1, y: 2, z: 0 } })

  // `as` : la stratégie et les objets sont privés par construction, et c'est eux qu'on mesure.
  const groups = renderer['instances'] as {
    moved: (ids: Iterable<string>, objectOf: (id: string) => Object3D | undefined) => boolean
    drawn: () => readonly Mesh[]
    follow?: (camera: PerspectiveCamera | null, cast?: unknown) => boolean
  }
  const objects = renderer['objects'] as Map<string, Object3D>
  const scene: Object3D = renderer['viewport'].scene
  const camera: PerspectiveCamera = renderer['viewport'].perspective

  const every = Math.max(1, Math.round(1 / share))
  let at = 0
  const movers: string[] = []
  for (const node of state.nodes) {
    if (node.type !== 'mesh' || !node.id.startsWith('prop')) continue
    at += 1
    if (at % every === 0) movers.push(node.id)
  }
  /** Où chaque mobile est parti, pour vérifier qu'il est dessiné LÀ et pas où il était. */
  const from = new Map(movers.flatMap(id => {
    const object = objects.get(id)
    return object ? [[id, object.position.x] as [string, number]] : []
  }))

  const read = (id: string): Object3D | undefined => objects.get(id)
  const widestBefore = widestCell(scene)

  const spent: number[] = []
  for (let frame = 0; frame < FRAMES; frame += 1) {
    for (const id of movers) {
      const object = objects.get(id)
      if (!object) continue
      object.position.x += SPEED
      object.updateMatrixWorld(true)
    }
    const started = performance.now()
    groups.moved(movers, read)
    spent.push(performance.now() - started)
  }

  // 🛑 `redraw` ne dessine pas, il DEMANDE une frame : lire le canvas juste après rend un tampon
  // quelconque, et la comparaison annonçait 85 % de pixels différents entre deux rendus
  // identiques. On dessine soi-même, et on lit dans la foulée.
  const gl = renderer['viewport'].gl
  if (!gl) throw new Error('the engine mounted no renderer')
  await nextFrame()
  // La zone d'abord : c'est elle qui décide quelles cellules sont dans la scène, et un corps
  // dont la cellule d'ORIGINE est hors champ est le cas que ce banc existe pour lire.
  groups.follow?.(camera, null)

  // 🛑 Le juge : chaque mobile est-il DESSINÉ là où il est maintenant ? Seules les mailles que le
  // rendu atteint comptent — mesh visible, et chaque groupe dont il pend avec lui.
  const drawnAt: number[] = []
  for (const mesh of groups.drawn()) {
    if (!(mesh instanceof InstancedMesh) || !isDrawn(mesh, scene)) continue
    const held = mesh.instanceMatrix.array
    for (let slot = 0; slot < mesh.count; slot += 1) drawnAt.push(held[slot * 16 + 12] ?? 0)
  }
  drawnAt.sort((one, other) => one - other)
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  )
  let adrift = 0
  let adriftInView = 0
  let worstDrift = 0
  for (const id of movers) {
    const object = objects.get(id)
    if (!object) continue
    if (nearestTo(drawnAt, object.position.x) <= 0.001) continue
    adrift += 1
    // Ceux-là seuls changent l'image : un corps absent hors du champ ne se voit pas, et une
    // comparaison de pixels ne dirait rien du défaut.
    if (frustum.containsPoint(object.position)) adriftInView += 1
    worstDrift = Math.max(worstDrift, Math.abs(object.position.x - (from.get(id) ?? 0)))
  }

  gl.render(scene, camera)
  const pixels = pixelsOf(canvas)

  const numbers: Numbers = {
    mode,
    declare,
    movers: movers.length,
    frames: FRAMES,
    travelled: FRAMES * SPEED,
    cellsCrossed: round((FRAMES * SPEED) / CELL_SIZE),
    updateMeanMs: round(mean(spent)),
    updatePeakMs: round(top(spent)),
    firstFrameMs: round(spent[0] ?? 0),
    widestCellBefore: widestBefore,
    widestCellAfter: widestCell(scene),
    meshes: groups.drawn().length,
    adrift,
    adriftInView,
    worstDrift: round(worstDrift),
  }
  renderer.dispose()
  return { numbers, pixels }
}

export async function runCrossing(
  onProgress?: (step: { phase: string }) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const count = Number(QUERY.get('count') ?? 500_000)
  const share = Number(QUERY.get('share') ?? 0.01)
  const results: unknown[] = []
  const failures: unknown[] = []
  const shots = new Map<string, Shot>()

  const arms: [string, PartitionMode, boolean][] = [
    ['off', 'off', false],
    ['grid', 'grid', false],
    ['gridDeclared', 'grid', true],
  ]
  const asked = QUERY.get('arms')?.split(',')
  for (const [label, mode, declare] of arms.filter(one => !asked || asked.includes(one[0]))) {
    try {
      onProgress?.({ phase: label })
      const shot = await measureOne(mode, count, share, declare)
      shots.set(label, shot)
      results.push({ label, ...shot.numbers })
    } catch (error) {
      // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
      failures.push({ label, error: String((error as { stack?: string }).stack ?? error) })
    }
    ;(globalThis as { __partial?: unknown }).__partial = { results, failures }
  }

  const off = shots.get('off')
  for (const label of ['grid', 'gridDeclared']) {
    const other = shots.get(label)
    if (!off || !other) continue
    results.push({ pixels: label, ...comparePixels(off.pixels, other.pixels, 0) })
  }
  return { results, failures }
}
