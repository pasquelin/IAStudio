import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it, vi } from 'vitest'
import * as instancing from '@/engines/scene/instancing'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { SHAPES, SHAPE_NAMES } from './sceneShapes'
import { rendererOf, reportPath } from './benchSupport'

/**
 * CHANTIER B, en lecture seule : ce que `regroupInstances` attrape vraiment.
 *
 * `rebuild` répond combien de noeuds une instance dessine ; ce qui reste est dessiné un par un.
 * Les appels de dessin sont donc les noeuds NON groupés, plus une instance par groupe.
 */

type Seen = { grouped: number; instances: number }

/** Enveloppe la fabrique pour lire ce que le regroupement a rendu, sans toucher au moteur. */
function watchGrouping(): { seen: Seen } {
  const seen: Seen = { grouped: 0, instances: 0 }
  const original = instancing.createInstancedGroups
  vi.spyOn(instancing, 'createInstancedGroups').mockImplementation((host, ownMaterialOf) => {
    const groups = original(host, ownMaterialOf)
    return {
      ...groups,
      rebuild: (nodes, objectOf) => {
        const count = groups.rebuild(nodes, objectOf)
        seen.grouped = count
        seen.instances = groups.drawn().length
        return count
      },
    }
  })
  return { seen }
}

describe('ce que le regroupement en instances attrape', () => {
  const report: Record<string, unknown>[] = []

  for (const shape of SHAPE_NAMES) {
    for (const count of [1000, 10_000, 50_000]) {
      it(`groupe ${count} noeuds, forme ${shape}`, { timeout: 900_000 }, () => {
        const { seen } = watchGrouping()
        const state: SceneState = { ...EMPTY_SCENE, nodes: SHAPES[shape](count) }
        rendererOf().apply(state)

        report.push({
          shape,
          count,
          grouped: seen.grouped,
          instances: seen.instances,
          drawCallsBefore: count,
          drawCallsAfter: count - seen.grouped + seen.instances,
        })
        vi.restoreAllMocks()
        expect(report.at(-1)).toBeDefined()
      })
    }
  }

  afterAll(() => {
    writeFileSync(
      reportPath('instancing-audit.json'),
      JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
    )
  })
})
