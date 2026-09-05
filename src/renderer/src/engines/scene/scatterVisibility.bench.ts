import { PerspectiveCamera, Vector3, type Object3D } from 'three'
import { bench } from 'vitest'
import { SCATTER_CATEGORIES, type ScatterCategory } from '@shared/domain/scene'
import { updateScatterVisibility } from './scatterVisibility'
import { buildPartition, cellKey, MAX_SPATIAL_REACH, type CellKey } from './worldPartition'

const camera = new PerspectiveCamera(50, 1, 0.1, 2_000)
camera.updateMatrixWorld(true)
const cells = fixture(50_000)
updateScatterVisibility(cells, camera)

bench('visibility before: unchanged camera and 50k batches', () => oldVisibility(cells, camera))
bench('visibility after: unchanged camera and 50k batches', () =>
  updateScatterVisibility(cells, camera),
)

function fixture(count: number) {
  const partitions = new Map(
    SCATTER_CATEGORIES.map(category => [category, buildPartition(category === 'props' ? 256 : 32)]),
  )
  const key = cellKey(0, 0)
  partitions.get('props')?.hold(key)
  return {
    byLayer: new Map([
      ['trees', { category: 'props' as const, cells: new Map([[key, objects(count)]]) }],
    ]),
    partitions,
    queried: new Map(SCATTER_CATEGORIES.map(category => [category, [] as CellKey[]])),
    wanted: new Map(SCATTER_CATEGORIES.map(category => [category, new Set<CellKey>()])),
    visibility: { x: 0, z: 0, reach: 0, revision: -1 },
    revision: 1,
  }
}

function objects(count: number): Object3D[] {
  return Array.from({ length: count }, () => ({ visible: true }) as Object3D)
}

const EYE = new Vector3()

function oldVisibility(cells: ReturnType<typeof fixture>, activeCamera: PerspectiveCamera): void {
  activeCamera.getWorldPosition(EYE)
  const reach = Math.min(activeCamera.far, MAX_SPATIAL_REACH)
  for (const category of SCATTER_CATEGORIES) {
    const queried = cells.queried.get(category) ?? []
    cells.partitions.get(category)?.query(EYE.x, EYE.z, reach, queried)
    const wanted = cells.wanted.get(category)
    wanted?.clear()
    for (const key of queried) wanted?.add(key)
  }
  for (const layer of cells.byLayer.values()) {
    for (const [key, drawn] of layer.cells) {
      const visible = cells.wanted.get(layer.category as ScatterCategory)?.has(key) ?? false
      for (const object of drawn) object.visible = visible
    }
  }
}
