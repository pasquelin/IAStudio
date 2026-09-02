import { Group, type InstancedMesh, type Mesh, type Object3D } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { mean, nextFrame, round, top } from './benchShared'
import { DEFAULT_PLAN, openWorld } from './openWorld'

/**
 * C5-P1, étape 4 : ce que coûte un corps qui BOUGE, sous le vrai moteur.
 *
 * 🛑 Un déplacement passe par `moved`, jamais par `apply` : c'est le chemin d'un geste et d'une
 * animation. Ce banc mesure ce chemin-là, et compte les meshes reconstruits — le chiffre que
 * C5-B2 § 4 oppose à 947 par frame dans une structure unique.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
const WARMUP = 8
const FRAMES = 40

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

/** Les meshes que la stratégie dessine, et combien d'instances au total. */
function shapeOf(groups: { drawn: () => readonly Mesh[] }): { meshes: number; instances: number } {
  let instances = 0
  for (const mesh of groups.drawn()) instances += (mesh as InstancedMesh).count ?? 0
  return { meshes: groups.drawn().length, instances }
}

async function measureOne(mode: PartitionMode, count: number, share: number): Promise<Numbers> {
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

  const state: SceneState = openWorld({ ...DEFAULT_PLAN, count })
  renderer.apply(state)
  renderer.placeView({ position: { x: 0, y: 2, z: 0 }, target: { x: 1, y: 2, z: 0 } })

  // `as` : la stratégie de dessin est privée par construction, et c'est elle qu'on mesure.
  const groups = renderer['instances'] as {
    moved: (ids: Iterable<string>, objectOf: (id: string) => Object3D | undefined) => boolean
    drawn: () => readonly Mesh[]
  }
  const objects = renderer['objects'] as Map<string, Object3D>

  // Les corps qui bougeront, choisis une fois : un tirage par frame mesurerait le tirage.
  const bodies = state.nodes.filter(node => node.type === 'mesh').map(node => node.id)
  const movers = bodies.filter((_unused, at) => at % Math.max(1, Math.round(1 / share)) === 0)

  const before = shapeOf(groups)
  // 🛑 Le document se déplace HORS du chronomètre : bouger 5 000 `Object3D` et recomposer leurs
  // matrices est le coût de l'éditeur, pas celui de la couche. Mélangés, ils faisaient lire 4 ms
  // là où la couche en coûte une fraction.
  const shove = (frame: number): void => {
    for (const id of movers) {
      const object = objects.get(id)
      if (!object) continue
      object.position.x += 0.01 * ((frame % 2) * 2 - 1)
      object.updateMatrixWorld(true)
    }
  }
  const read = (id: string): Object3D | undefined => objects.get(id)

  await nextFrame()
  shove(0)
  const promoteAt = performance.now()
  groups.moved(movers, read)
  const promoteMs = performance.now() - promoteAt
  for (let frame = 1; frame < WARMUP; frame += 1) {
    shove(frame)
    groups.moved(movers, read)
  }
  const afterWarm = shapeOf(groups)

  const spent: number[] = []
  const shoved: number[] = []
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const shoveAt = performance.now()
    shove(frame)
    shoved.push(performance.now() - shoveAt)
    const at = performance.now()
    groups.moved(movers, read)
    spent.push(performance.now() - at)
  }
  const after = shapeOf(groups)

  renderer.dispose()
  return {
    mode,
    count,
    share: round(share * 100),
    movers: movers.length,
    updateMeanMs: round(mean(spent)),
    updatePeakMs: round(top(spent)),
    documentMeanMs: round(mean(shoved)),
    promoteMs: round(promoteMs),
    meshesBefore: before.meshes,
    meshesAfterWarmup: afterWarm.meshes,
    meshesAfter: after.meshes,
    // Le chiffre du § 4 : combien de meshes la couche a fait naître ou mourir PENDANT la mesure.
    meshesRebuilt: after.meshes - afterWarm.meshes,
    instancesAfter: after.instances,
  }
}

/** Spawn : autant de corps créés que détruits par frame, par `apply`. */
async function measureSpawn(mode: PartitionMode, count: number): Promise<Numbers> {
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

  const state = openWorld({ ...DEFAULT_PLAN, count })
  renderer.apply(state)

  const kept = state.nodes.filter(node => node.type !== 'mesh' || !node.id.startsWith('prop'))
  const props = state.nodes.filter((node): node is SceneNode => node.id.startsWith('prop'))
  const states: SceneState[] = []
  for (let frame = 0; frame < 12; frame += 1) {
    states.push({ ...state, nodes: [...kept, ...props.slice(frame * 200)] })
  }

  // `as` : la stratégie est privée par construction, et c'est SA part du spawn qu'on isole.
  const groups = renderer['instances'] as {
    rebuild: (nodes: readonly SceneNode[], objectOf: (id: string) => Object3D | undefined) => number
  }
  const objects = renderer['objects'] as Map<string, Object3D>
  const read = (id: string): Object3D | undefined => objects.get(id)

  const spent: number[] = []
  const whole: number[] = []
  for (const next of states) {
    const at = performance.now()
    groups.rebuild(next.nodes, read)
    spent.push(performance.now() - at)
  }
  // Et ce qu'un vrai spawn coûte dans le produit : `apply`, réconciliation du studio comprise.
  const wholeAt = performance.now()
  renderer.apply(states[1] ?? state)
  whole.push(performance.now() - wholeAt)

  renderer.dispose()
  return {
    mode,
    count,
    scenario: 'spawn',
    rebuildMeanMs: round(mean(spent)),
    rebuildPeakMs: round(top(spent)),
    applyMs: round(whole[0] ?? 0),
  }
}

export type Step = { phase: string }

export async function runDynamicLayer(
  onProgress?: (step: Step) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const count = Number(QUERY.get('count') ?? 500_000)
  const results: unknown[] = []
  const failures: unknown[] = []

  for (const mode of ['off', 'grid'] as PartitionMode[]) {
    for (const share of [0.01, 0.05]) {
      try {
        onProgress?.({ phase: `${mode} · ${share * 100} %` })
        results.push(await measureOne(mode, count, share))
      } catch (error) {
        // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
        failures.push({ mode, share, error: String((error as { stack?: string }).stack ?? error) })
      }
    }
    try {
      onProgress?.({ phase: `${mode} · spawn` })
      results.push(await measureSpawn(mode, count))
    } catch (error) {
      // `as` : idem.
      failures.push({ mode, scenario: 'spawn', error: String((error as { stack?: string }).stack ?? error) })
    }
    ;(globalThis as { __partial?: unknown }).__partial = { results, failures }
  }
  return { results, failures }
}
