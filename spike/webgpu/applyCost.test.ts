import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { SHAPES, SHAPE_NAMES } from './sceneShapes'
import {
  rendererOf,
  reportPath,
  statesOf,
  timed,
  timedOver,
  withAllMoved,
  withOneMoved,
} from './benchSupport'

/**
 * Ce que la synchronisation coûte, sans une ligne de GPU : le renderer n'est jamais monté, donc
 * `redraw` n'a rien à peindre et seule la passe sur l'état est chronométrée.
 *
 * 🛑 La colonne qui commande est `un seul noeud bougé` : celle de `studioRender`, payée à chaque
 * frame d'une partie en cours.
 */

const COUNTS = [1000, 10_000, 50_000]
const REPEATS = 12
// Moins de répétitions : chaque état pré-composé clone les N noeuds ET leurs transforms, et douze
// copies de 50 000 noeuds tiennent la mémoire pendant toute la mesure.
const HEAVY_REPEATS = 4

describe('ce que la synchronisation scène → three coûte, hors GPU', () => {
  const report: Record<string, unknown>[] = []

  for (const shape of SHAPE_NAMES) {
    for (const count of COUNTS) {
      it(`applique ${count} noeuds, forme ${shape}`, { timeout: 900_000 }, () => {
        const state: SceneState = { ...EMPTY_SCENE, nodes: SHAPES[shape](count) }
        const renderer = rendererOf()
        const nudged = statesOf(state, REPEATS, withOneMoved)
        const shifted = statesOf(state, HEAVY_REPEATS, withAllMoved)

        const first = timed(1, () => renderer.apply(state))
        // La chauffe suit le premier apply : les passes qui redimensionnent une carte d'ombre ou
        // taillent un frustum ne le refont pas, et sans elle la première colonne mesurée l'hérite.
        for (const warm of statesOf(state, 4, withOneMoved)) renderer.apply(warm)
        const identical = timed(REPEATS, () => renderer.apply(state))
        const oneMoved = timedOver(nudged, moved => renderer.apply(moved))
        const allMoved = timedOver(shifted, moved => renderer.apply(moved))
        // Ce que `studioRender` paie EN PLUS d'`apply`, chaque frame, avant même de l'appeler.
        const rebuildOnly = timed(REPEATS, at => void withOneMoved(state, at))

        report.push({ shape, count, first, identical, oneMoved, allMoved, rebuildOnly })
        expect(report.at(-1)).toBeDefined()
      })
    }
  }

  // `afterAll` plutôt qu'un `it` final : un `-t` ou un `.only` sur un seul cas écrirait sinon un
  // rapport vide sans que rien ne rougisse.
  afterAll(() => {
    writeFileSync(
      reportPath(process.env.APPLY_OUT ?? 'apply-results.json'),
      JSON.stringify({ at: new Date().toISOString(), repeats: REPEATS, report }, null, 2),
    )
  })
})
