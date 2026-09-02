import { Group, InstancedMesh, type Object3D, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { GeometryDescriptor } from '@shared/domain/geometry'
import type { SceneState } from '@/engines/scene/sceneState'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { sceneVaried, type ShapeLevel } from './engineScenes'
import { checker } from './floorScenes.js'
import { pacedLod, type PacedLod } from './pacedLod'

/**
 * L'étape 2C : ce que le LOD AJOUTE au prix d'un changement de contenu.
 *
 * `markContentChanged` reconstruit tous les groupes, ce qui vaut déjà ~110 ms sur 50 000 corps
 * SANS LOD. Un rig accroché aux `InstancedMesh` meurt avec eux, donc il faut le rebâtir : ce banc
 * mesure la dette existante et celle qu'ajoute le LOD, séparément, sur les mêmes gestes.
 *
 * Aucune optimisation ici — seulement des sondes.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
/** Une même opération jouée plusieurs fois : la colonne du regroupement est bruitée. */
const PASSES = Number(QUERY.get('passes') ?? 5)

const round = (value: number): number => Math.round(value * 1000) / 1000
const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0)
}

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

type Numbers = Record<string, number | string | null | number[]>

/** Les quatre gestes qui passent par `markContentChanged`, et ce qu'ils font à l'état. */
const SMALLER: GeometryDescriptor = {
  kind: 'sphere',
  radius: 0.6,
  widthSegments: 12,
  heightSegments: 8,
}

type Case = 'added' | 'removed' | 'geometry' | 'material'

function stateFor(kind: Case, base: SceneState): SceneState {
  const nodes = base.nodes
  if (kind === 'added') {
    const born = meshNode('added')
    return { ...base, nodes: [...nodes, { ...born, material: { ...born.material, color: '#ff5544' } }] }
  }
  if (kind === 'removed') return { ...base, nodes: nodes.slice(0, nodes.length - 1) }

  const last = nodes[nodes.length - 1]
  if (!last || last.type !== 'mesh') throw new Error('the last node is not a mesh')
  const edited =
    kind === 'geometry'
      ? { ...last, geometry: SMALLER }
      : { ...last, material: { ...last.material, color: '#0055ff' } }
  return { ...base, nodes: [...nodes.slice(0, nodes.length - 1), edited] }
}

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

/** Ce que la scène dessine vraiment, pour comparer un rig reconstruit à un rig neuf. */
function drawnBy(scene: Object3D): { bodies: number; triangles: number; shelves: number } {
  let bodies = 0
  let triangles = 0
  let shelves = 0
  scene.traverse(object => {
    if (!(object instanceof InstancedMesh) || !object.visible || object.count === 0) return
    shelves += 1
    bodies += object.count
    const geometry = object.geometry
    triangles +=
      ((geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3) * object.count
  })
  return { bodies, triangles: Math.round(triangles), shelves }
}

export type Step = { kind: string; phase: string }

async function measureOne(
  level: ShapeLevel,
  withLod: boolean,
  warm: boolean,
  onProgress?: (step: Step) => void,
): Promise<Numbers[]> {
  const host = hostOf()
  const texture: Texture = checker()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping: 'instanced',
    loadModel: async () => new Group(),
    loadTexture: async () => texture,
  })
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })

  const count = Number(QUERY.get('bodies') ?? 50_000)
  const base = sceneVaried(count, 7, level)
  const scene = renderer['viewport'].scene
  const camera = renderer['viewport'].perspective

  const rows: Numbers[] = []
  for (const kind of ['added', 'removed', 'geometry', 'material'] as Case[]) {
    onProgress?.({ kind, phase: withLod ? 'avec LOD' : 'sans LOD' })
    const applied: number[] = []
    const disposed: number[] = []
    const built: number[] = []
    const converged: number[] = []
    const phases = { laddersMs: [] as number[], shelvesMs: [] as number[], tablesMs: [] as number[] }
    let seen: ReturnType<typeof drawnBy> | null = null
    let fresh: ReturnType<typeof drawnBy> | null = null
    let shelfCount = 0

    for (let pass = 0; pass < PASSES; pass += 1) {
      // Toujours repartir de l'état de base, rig construit et CONVERGÉ : ce qu'on mesure est une
      // modification d'une scène déjà ouverte, jamais un premier chargement.
      renderer.apply(base)
      let lod: PacedLod | null = withLod ? pacedLod(scene, level) : null
      if (lod) {
        lod.mark(camera)
        lod.pump(camera, HEIGHT, 0)
      }
      await nextFrame()

      const changed = stateFor(kind, base)
      const disposeFrom = performance.now()
      // Avant `apply`, qui détruit les lots : les étagères ne sont pas à lui, elles resteraient
      // dans la scène en double.
      lod?.dispose(warm)
      disposed.push(performance.now() - disposeFrom)

      const applyFrom = performance.now()
      renderer.apply(changed)
      applied.push(performance.now() - applyFrom)

      if (withLod) {
        const held = warm ? lod?.ladders() : undefined
        const buildFrom = performance.now()
        lod = pacedLod(scene, level, undefined, held)
        built.push(performance.now() - buildFrom)

        const convergeFrom = performance.now()
        lod.mark(camera)
        lod.pump(camera, HEIGHT, 0)
        converged.push(performance.now() - convergeFrom)

        const parts = lod.builtIn()
        phases.laddersMs.push(parts.laddersMs)
        phases.shelvesMs.push(parts.shelvesMs)
        phases.tablesMs.push(parts.tablesMs)
        shelfCount = lod.shelves()
        seen = drawnBy(scene)
      }
      await nextFrame()

      // Le même état, mais monté à neuf : c'est la référence fonctionnelle du rig reconstruit.
      if (withLod && pass === PASSES - 1) {
        lod?.dispose()
        renderer.apply(changed)
        const clean = pacedLod(scene, level)
        clean.mark(camera)
        clean.pump(camera, HEIGHT, 0)
        await nextFrame()
        fresh = drawnBy(scene)
        clean.dispose()
      } else {
        lod?.dispose()
      }
    }

    rows.push({
      kind,
      lod: withLod ? (warm ? 'tiède' : 'froid') : 'aucun',
      applyMs: round(median(applied)),
      applyRaw: applied.map(round),
      disposeMs: round(median(disposed)),
      buildMs: withLod ? round(median(built)) : 0,
      convergeMs: withLod ? round(median(converged)) : 0,
      totalMs: round(
        median(applied) + median(disposed) + (withLod ? median(built) + median(converged) : 0),
      ),
      laddersMs: withLod ? round(median(phases.laddersMs)) : 0,
      shelvesMs: withLod ? round(median(phases.shelvesMs)) : 0,
      tablesMs: withLod ? round(median(phases.tablesMs)) : 0,
      shelves: shelfCount,
      drawnBodies: seen?.bodies ?? null,
      drawnTriangles: seen?.triangles ?? null,
      freshBodies: fresh?.bodies ?? null,
      freshTriangles: fresh?.triangles ?? null,
    })
  }

  renderer.dispose()
  host.remove()
  texture.dispose()
  await pause(400)
  return rows
}

export async function runLodRebuild(
  onProgress?: (step: Step) => void,
): Promise<{ results: Numbers[]; failures: unknown[] }> {
  const level = (QUERY.get('lod') ?? 'product') as ShapeLevel
  const results: Numbers[] = []
  const failures: unknown[] = []
  // L'ordre est inversable, comme en C1 et C2 : le tas suit l'ordre de mesure.
  const order =
    QUERY.get('order') === 'reversed'
      ? ([[true, true], [true, false], [false, false]] as const)
      : ([[false, false], [true, false], [true, true]] as const)
  for (const [withLod, warm] of order) {
    try {
      results.push(...(await measureOne(level, withLod, warm, onProgress)))
    } catch (error) {
      failures.push({ withLod, warm, error: String(error) })
    }
    ;(globalThis as unknown as { __partial: unknown }).__partial = { results, failures }
  }
  return { results, failures }
}
