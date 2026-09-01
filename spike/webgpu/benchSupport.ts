import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Group } from 'three'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'

/** Ce que les deux bancs partagent : un moteur nu, des perturbations, un chronomètre. */

export const rendererOf = (): SceneRenderer =>
  new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, loadModel: async () => new Group() })

/** Générique, jamais un spread de l'union : `{ ...node }` sur `SceneNode` en perd le type. */
const nudged = <T extends SceneNode>(node: T, at: number): T => ({
  ...node,
  transform: { ...node.transform, position: { x: at * 0.01, y: 0, z: 0 } },
})

/**
 * Ce que `studioRender` remet : un tableau neuf, UN seul noeud d'identité neuve.
 *
 * 🛑 Toujours le DERNIER noeud, jamais `at % length` : un index qui tourne remet le noeud
 * précédent à son origine, donc deux noeuds changeaient d'identité et la colonne mesurait le
 * double de ce que son nom annonce. Le dernier est un corps dans les trois formes — les lampes
 * ouvrent la liste, et bouger une lampe déclenche une passe d'ombres qui n'est pas ce cas-ci.
 */
export const withOneMoved = (state: SceneState, at: number): SceneState => {
  const last = state.nodes.length - 1
  return { ...state, nodes: state.nodes.map((node, index) => (index === last ? nudged(node, at) : node)) }
}

export const withAllMoved = (state: SceneState, at: number): SceneState => ({
  ...state,
  nodes: state.nodes.map(node => nudged(node, at)),
})

/**
 * 🛑 Les états sont composés AVANT le chronomètre, jamais dans son callback : recomposer un
 * tableau de 50 000 noeuds coûte des millisecondes, et les compter comme du temps d'`apply`
 * fausse la mesure que ce banc existe pour rendre.
 */
export const statesOf = (
  state: SceneState,
  times: number,
  perturb: (state: SceneState, at: number) => SceneState,
): SceneState[] => Array.from({ length: times }, (_unused, at) => perturb(state, at))

const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  const middle = Math.floor(sorted.length / 2)
  const above = sorted[middle] ?? 0
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? above) + above) / 2 : above
}

const rounded = (value: number): number => Math.round(value * 1000) / 1000

export type Timing = { median: number; min: number; max: number }

const summarise = (samples: number[]): Timing => ({
  median: rounded(median(samples)),
  min: rounded(Math.min(...samples)),
  max: rounded(Math.max(...samples)),
})

export const timed = (times: number, run: (at: number) => void): Timing => {
  const samples: number[] = []
  for (let at = 0; at < times; at++) {
    const started = performance.now()
    run(at)
    samples.push(performance.now() - started)
  }
  return summarise(samples)
}

/** Itère les états plutôt qu'un index : rien à indexer, donc rien qui puisse manquer. */
export const timedOver = <T>(items: readonly T[], run: (item: T) => void): Timing => {
  const samples: number[] = []
  for (const item of items) {
    const started = performance.now()
    run(item)
    samples.push(performance.now() - started)
  }
  return summarise(samples)
}



/** Le rapport s'écrit sous la racine du dépôt ; lancé d'ailleurs, il le DIT plutôt que d'errer. */
export function reportPath(name: string): string {
  const where = resolve('spike/webgpu')
  if (!existsSync(where)) {
    throw new Error(`banc lancé hors de la racine du dépôt : ${where} n'existe pas`)
  }
  return resolve(where, name)
}
