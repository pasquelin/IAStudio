import { writeFileSync } from 'node:fs'
import { BoxGeometry, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import { SCENE_TEMPLATE_IDS } from '@shared/domain/sceneTemplate'
import { createInstancedGroups, keepsItsGroup } from '@/engines/scene/instancing'
import { playgroundNodes } from '@/engines/scene/playgroundLevel'
import { sceneFromTemplate } from '@/engines/scene/sceneTemplates'
import type { SceneNode } from '@/engines/scene/sceneState'
import { reportPath } from './benchSupport'

/**
 * Ce que descendre le plancher change sur les scènes que le produit sait ouvrir, avant de
 * chercher ce qu'il casse. La clé d'un groupe est composée comme `instancing.ts` la compose.
 */

const keyOf = (node: SceneNode): string =>
  node.type === 'mesh'
    ? `${JSON.stringify(node.geometry)}|${JSON.stringify(node.material)}|${node.castShadow ? 1 : 0}${node.receiveShadow ? 1 : 0}${node.negative === true ? 1 : 0}`
    : ''

function sizes(nodes: readonly SceneNode[]): number[] {
  const groups = new Map<string, number>()
  for (const node of nodes) {
    if (node.type !== 'mesh' || !node.visible) continue
    const key = keyOf(node)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return [...groups.values()].sort((one, other) => other - one)
}

const instancedAt = (floor: number, group: number[]): number =>
  group.filter(size => size >= floor).reduce((sum, size) => sum + size, 0)

describe('ce que le plancher change sur les scènes du produit', () => {
  const report: Record<string, unknown>[] = []

  const scenes: [string, SceneNode[]][] = [
    ...SCENE_TEMPLATE_IDS.map(id => [`template:${id}`, sceneFromTemplate(id).nodes] as [string, SceneNode[]]),
    ['playground', playgroundNodes()],
  ]

  for (const [name, nodes] of scenes) {
    it(`compte les groupes de ${name}`, () => {
      const group = sizes(nodes)
      report.push({
        scene: name,
        nodes: nodes.length,
        meshes: nodes.filter(node => node.type === 'mesh').length,
        groups: group.length,
        largest: group.slice(0, 6),
        instancedAt64: instancedAt(64, group),
        instancedAt16: instancedAt(16, group),
        // La zone que le changement ouvre : les groupes qui n'étaient pas instanciés et le sont.
        newlyInstanced: group.filter(size => size >= 16 && size < 64).reduce((sum, size) => sum + size, 0),
      })
      expect(report.at(-1)).toBeDefined()
    })
  }

  /** Le regroupement RÉEL sur une scène du produit, pour confirmer ce que le comptage annonce. */
  it('confirme le compte par un vrai regroupement', () => {
    const nodes = playgroundNodes().filter(node => node.type === 'mesh')
    const geometry = new BoxGeometry(1, 1, 1)
    const objects = new Map<string, Object3D>(
      nodes.map(node => [node.id, new Mesh(geometry, new MeshStandardMaterial())]),
    )
    const groups = createInstancedGroups(new Mesh())
    const grouped = groups.rebuild(nodes, id => objects.get(id))
    report.push({ scene: 'playground (regroupement réel)', grouped, instances: groups.drawn().length })
    groups.dispose()
    expect(keepsItsGroup(nodes[0]!, nodes[0]!)).toBe(true)
  })

  afterAll(() => {
    writeFileSync(
      reportPath('floor-impact.json'),
      JSON.stringify({ at: new Date().toISOString(), report }, null, 2),
    )
  })
})
