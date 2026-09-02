import { Box3, Group, InstancedMesh, Matrix4, Vector3, type Texture } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { TRIANGLES_PER_REGION } from '@/engines/scene/instanceRegions'
import { checker } from './floorScenes.js'
import { nextFrame, round } from './benchShared'
import { DEFAULT_PLAN, openWorld, spanFor, type WorldSpread } from './openWorld'

/**
 * C5-B0.2 : ce que le moteur contient VRAIMENT, mesuré plutôt que supposé.
 *
 * Le choix d'une structure spatiale part de ces chiffres. Ce banc lit la scène que `apply` a
 * bâtie — les `InstancedMesh` réels, leurs boîtes réelles — et non l'état dont elle est née.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)

const quantile = (sorted: number[], share: number): number =>
  sorted.length === 0 ? 0 : round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0)

const spread = (values: number[]): Record<string, number> => {
  const sorted = [...values].sort((one, other) => one - other)
  return {
    count: sorted.length,
    min: quantile(sorted, 0),
    median: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    p99: quantile(sorted, 0.99),
    max: round(sorted[sorted.length - 1] ?? 0),
  }
}

const trianglesOf = (mesh: InstancedMesh): number =>
  (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position')?.count ?? 0) / 3

/**
 * Ce qu'une région PÈSE et ce qu'elle COUVRE, lu sur ses matrices d'instance.
 *
 * C'est le chiffre qui décide : une région dont la boîte couvre la moitié du monde touche presque
 * tout frustum, et dessine alors chacune de ses instances quoi que la caméra regarde.
 */
function regionFacts(mesh: InstancedMesh): { instances: number; triangles: number; side: number } {
  const box = new Box3()
  const at = new Matrix4()
  const point = new Vector3()
  for (let slot = 0; slot < mesh.count; slot += 1) {
    mesh.getMatrixAt(slot, at)
    box.expandByPoint(point.setFromMatrixPosition(at))
  }
  const size = box.getSize(new Vector3())
  return {
    instances: mesh.count,
    triangles: trianglesOf(mesh),
    side: round(Math.max(size.x, size.z)),
  }
}

export async function runWorldStats(): Promise<{ results: unknown[]; failures: unknown[] }> {
  const count = Number(QUERY.get('bodies') ?? 500_000)
  const spreadName = (QUERY.get('spread') ?? 'uniform') as WorldSpread
  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)

  const texture: Texture = checker()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    grouping: 'instanced',
    loadModel: async () => new Group(),
    loadTexture: async () => texture,
  })
  try {
    renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
    renderer.mount(host)
    renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows: true })

    const plan = { ...DEFAULT_PLAN, count, spread: spreadName }
    const state = openWorld(plan)
    renderer.apply(state)
    await nextFrame()

    // ── les corps, par classe, tels que le DOCUMENT les décrit
    const sizes = { prop: [] as number[], landmark: [] as number[], tile: [] as number[] }
    const heights = { prop: [] as number[], landmark: [] as number[] }
    let lowY = Infinity
    let highY = -Infinity
    for (const node of state.nodes) {
      if (node.type !== 'mesh') continue
      const { x, y, z } = node.transform.scale
      const widest = Math.max(x, z)
      if (node.id.startsWith('tile_')) sizes.tile.push(widest)
      else if (node.id.startsWith('mark')) {
        sizes.landmark.push(widest)
        heights.landmark.push(y)
      } else {
        sizes.prop.push(widest)
        heights.prop.push(y)
      }
      lowY = Math.min(lowY, node.transform.position.y - y / 2)
      highY = Math.max(highY, node.transform.position.y + y / 2)
    }

    // ── les régions, telles que le MOTEUR les a posées
    const regions: { instances: number; triangles: number; side: number }[] = []
    renderer['viewport'].scene.traverse(object => {
      if (object instanceof InstancedMesh) regions.push(regionFacts(object))
    })
    const span = spanFor(count)
    const worldSide = span * 2

    return {
      results: [
        {
          count,
          spread: spreadName,
          world: {
            spanXZ: round(worldSide),
            extentY: round(highY - lowY),
            flatness: round(worldSide / Math.max(highY - lowY, 0.001)),
            bodies: sizes.prop.length + sizes.landmark.length + sizes.tile.length,
            densityPerSquareUnit: round((sizes.prop.length + sizes.landmark.length) / (worldSide * worldSide) * 1e6) / 1e6,
          },
          footprint: {
            prop: spread(sizes.prop),
            landmark: spread(sizes.landmark),
            tile: spread(sizes.tile),
          },
          height: { prop: spread(heights.prop), landmark: spread(heights.landmark) },
          regions: {
            total: regions.length,
            trianglesPerRegionBudget: TRIANGLES_PER_REGION,
            instances: spread(regions.map(one => one.instances)),
            // 🛑 Le côté d'une région, en unités de monde. Rapporté au monde entier, il dit si le
            // grain spatial existe : une région qui couvre le monde ne rejette jamais rien.
            side: spread(regions.map(one => one.side)),
            sideOverWorld: spread(regions.map(one => round(one.side / worldSide))),
            // Ce que le budget en TRIANGLES accorde : une forme légère se découpe peu, quelle que
            // soit l'étendue qu'elle occupe.
            byShapeTriangles: [...new Set(regions.map(one => one.triangles))].sort((a, b) => a - b).map(triangles => {
              const family = regions.filter(one => one.triangles === triangles)
              return {
                trianglesPerInstance: triangles,
                regions: family.length,
                instancesTotal: family.reduce((sum, one) => sum + one.instances, 0),
                medianInstances: quantile(family.map(one => one.instances).sort((a, b) => a - b), 0.5),
                medianSide: quantile(family.map(one => one.side).sort((a, b) => a - b), 0.5),
              }
            }),
          },
        },
      ],
      failures: [],
    }
  } finally {
    renderer.dispose()
    host.remove()
    texture.dispose()
  }
}
