import { writeFileSync } from 'node:fs'
import { BoxGeometry, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import { createInstancedGroups } from '@/engines/scene/instancing'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/sceneState'
import { reportPath } from './benchSupport'

/**
 * CHANTIER B, seconde moitié : ce que le REGROUPEMENT coûte, par taille de groupe.
 *
 * Le banc en page mesure ce qu'un rendu déjà groupé économise. Le plancher, lui, défend contre
 * le prix de `rebuild`, payé à chaque changement de contenu — et c'est cette moitié-là qu'aucune
 * mesure ne portait.
 */

const TOTAL = 10_000
const SIZES = [4, 8, 16, 32, 64, 128, 256, 1000]
const ROUNDS = 8

const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}
const round = (value: number): number => Math.round(value * 1000) / 1000

/** Un groupe est un couple (géométrie, matériau) : la taille se règle en variant la paire. */
function nodesInGroups(groupSize: number): SceneNode[] {
  return Array.from({ length: TOTAL }, (_unused, index) => {
    const node = meshNode(`node_${index}`)
    const group = Math.floor(index / groupSize)
    return { ...node, material: { ...node.material, color: `#${(group % 4096).toString(16).padStart(3, '0')}` } }
  })
}

describe('ce que le regroupement en instances coûte, par taille de groupe', () => {
  const report: Record<string, unknown>[] = []

  for (const groupSize of SIZES) {
    it(`regroupe ${TOTAL} noeuds par ${groupSize}`, { timeout: 900_000 }, () => {
      const nodes = nodesInGroups(groupSize)
      const geometry = new BoxGeometry(1, 1, 1)
      const objects = new Map<string, Object3D>(
        nodes.map(node => [node.id, new Mesh(geometry, new MeshStandardMaterial())]),
      )
      const host = new Mesh()
      const groups = createInstancedGroups(host)
      const objectOf = (id: string): Object3D | undefined => objects.get(id)

      const samples: number[] = []
      let grouped = 0
      for (let at = 0; at < ROUNDS; at++) {
        const started = performance.now()
        grouped = groups.rebuild(nodes, objectOf)
        samples.push(performance.now() - started)
      }

      report.push({
        groupSize,
        groups: Math.ceil(TOTAL / groupSize),
        grouped,
        instances: groups.drawn().length,
        rebuildMs: round(median(samples)),
      })
      groups.dispose()
      expect(report.at(-1)).toBeDefined()
    })
  }

  afterAll(() => {
    writeFileSync(
      reportPath('group-rebuild.json'),
      JSON.stringify({ at: new Date().toISOString(), total: TOTAL, rounds: ROUNDS, report }, null, 2),
    )
  })
})
