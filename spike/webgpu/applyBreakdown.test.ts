import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { SHAPES, SHAPE_NAMES } from './sceneShapes'
import { rendererOf, reportPath, statesOf, withOneMoved } from './benchSupport'

/**
 * OÙ part le temps d'`apply`, sous-passe par sous-passe. Les méthodes sont enveloppées sur le
 * prototype : le banc ne touche pas une ligne de `src/`, et voit ce qu'un profileur verrait.
 *
 * 🛑 `residualMs` est le chiffre que ce fichier existe pour rendre : ce qu'`apply` fait dans son
 * PROPRE corps — le `Set` des vivants, le balayage des orphelins — qu'aucune sous-passe ne porte.
 */

const WATCHED = [
  'sweepCompositions',
  'syncNode',
  'release',
  'hangFromParent',
  'poseMarkers',
  'applyPoses',
  'tuneShadowsIfMoved',
  'tuneShadows',
  'measureShadowReach',
  'framedObjects',
  'applyCameraShots',
  'showAidsForSelection',
  'refreshAids',
  'applyWorld',
  'attachGizmo',
  'regroupInstances',
  'reportStats',
  'redraw',
]

const ROUNDS = 10
const WARMUP = 4

type Bag = Record<string, { ms: number; calls: number }>

function instrument(): { tally: Bag; restore: () => void } {
  // Les méthodes surveillées sont privées : le type public de la classe ne les porte pas.
  const prototype = SceneRenderer.prototype as unknown as Record<string, unknown>
  const tally: Bag = {}
  const originals: Record<string, unknown> = {}

  for (const name of WATCHED) {
    const original = prototype[name]
    // Une méthode renommée disparaîtrait du rapport en silence, son coût versé au résiduel.
    if (typeof original !== 'function') throw new Error(`SceneRenderer n'a plus de ${name}`)
    originals[name] = original
    const bucket = { ms: 0, calls: 0 }
    tally[name] = bucket
    // Deux paramètres nommés, jamais un rest : `...args` alloue un tableau par appel, soit
    // 50 000 allocations par frame sur `syncNode`, et c'est ce que le premier spike a lu comme
    // une superlinéarité de `hangFromParent`.
    const call = original as (this: unknown, one?: unknown, two?: unknown) => unknown
    prototype[name] = function wrapped(this: unknown, one?: unknown, two?: unknown) {
      const started = performance.now()
      const out = call.call(this, one, two)
      bucket.ms += performance.now() - started
      bucket.calls += 1
      return out
    }
  }

  return {
    tally,
    restore: () => {
      for (const [name, original] of Object.entries(originals)) prototype[name] = original
    },
  }
}

describe('où part le temps de apply', () => {
  const report: Record<string, unknown>[] = []

  for (const shape of SHAPE_NAMES) {
    for (const count of [10_000, 50_000]) {
      it(`ventile ${count} noeuds, forme ${shape}`, { timeout: 900_000 }, () => {
        const state: SceneState = { ...EMPTY_SCENE, nodes: SHAPES[shape](count) }
        const renderer = rendererOf()
        renderer.apply(state)
        const states = statesOf(state, ROUNDS * 2 + WARMUP, withOneMoved)
        const warmup = states.slice(0, WARMUP)
        const forBare = states.slice(WARMUP, WARMUP + ROUNDS)
        const forWrapped = states.slice(WARMUP + ROUNDS)
        // 🛑 Sans cette chauffe, la première boucle paie un amorçage que la seconde ne paie plus,
        // et le banc a rendu un total NU supérieur au total INSTRUMENTÉ sur les scènes éclairées.
        for (const warm of warmup) renderer.apply(warm)

        // Le total SANS enveloppe d'abord : c'est lui qui fait foi, et le rapport entre les deux
        // dit ce que l'instrumentation coûte plutôt que de le laisser deviner.
        const bare = performance.now()
        for (const moved of forBare) renderer.apply(moved)
        const bareMs = (performance.now() - bare) / ROUNDS

        // `finally` : un `apply` qui jette laisserait les quinze méthodes enveloppées pour tous
        // les cas suivants du fichier, dont les compteurs gonfleraient sans que rien ne le dise.
        const { tally, restore } = instrument()
        let totalMs = 0
        try {
          const started = performance.now()
          for (const moved of forWrapped) renderer.apply(moved)
          totalMs = (performance.now() - started) / ROUNDS
        } finally {
          restore()
        }

        const parts = Object.entries(tally)
          .map(([name, seen]) => ({
            name,
            ms: Math.round((seen.ms / ROUNDS) * 1000) / 1000,
            calls: seen.calls / ROUNDS,
          }))
          .filter(one => one.ms > 0.001)
          .sort((one, other) => other.ms - one.ms)

        report.push({
          shape,
          count,
          bareMs: Math.round(bareMs * 1000) / 1000,
          instrumentedMs: Math.round(totalMs * 1000) / 1000,
          residualMs:
            Math.round((totalMs - parts.reduce((sum, one) => sum + one.ms, 0)) * 1000) / 1000,
          parts,
        })
        expect(parts.length).toBeGreaterThan(0)
      })
    }
  }

  afterAll(() => {
    writeFileSync(
      reportPath(process.env.BREAKDOWN_OUT ?? 'apply-breakdown.json'),
      JSON.stringify({ at: new Date().toISOString(), rounds: ROUNDS, report }, null, 2),
    )
  })
})
