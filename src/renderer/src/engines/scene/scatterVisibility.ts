import { Vector3, type Camera, type Object3D } from 'three'
import { SCATTER_CATEGORIES, type ScatterCategory } from '@shared/domain/scene'
import { MAX_SPATIAL_REACH, type CellKey, type WorldPartition } from './worldPartition'

type ScatterVisibilityCells = {
  byLayer: Map<string, { category: ScatterCategory; cells: Map<CellKey, Object3D[]> }>
  partitions: Map<ScatterCategory, WorldPartition>
  queried: Map<ScatterCategory, CellKey[]>
  wanted: Map<ScatterCategory, Set<CellKey>>
  visibility: { x: number; z: number; reach: number; revision: number }
  revision: number
}

const SCATTER_EYE = new Vector3()

export function updateScatterVisibility(cells: ScatterVisibilityCells, camera: Camera): boolean {
  camera.getWorldPosition(SCATTER_EYE)
  const reach =
    'far' in camera && typeof camera.far === 'number'
      ? Math.min(camera.far, MAX_SPATIAL_REACH)
      : MAX_SPATIAL_REACH
  if (visibilityIsCurrent(cells, SCATTER_EYE.x, SCATTER_EYE.z, reach)) return false
  queryWantedCells(cells, reach)
  const changed = applyVisibility(cells)
  rememberVisibility(cells, SCATTER_EYE.x, SCATTER_EYE.z, reach)
  return changed
}

function queryWantedCells(cells: ScatterVisibilityCells, reach: number): void {
  for (const category of SCATTER_CATEGORIES) {
    const queried = cells.queried.get(category) ?? []
    cells.partitions.get(category)?.query(SCATTER_EYE.x, SCATTER_EYE.z, reach, queried)
    const wanted = cells.wanted.get(category)
    wanted?.clear()
    for (const key of queried) wanted?.add(key)
  }
}

function applyVisibility(cells: ScatterVisibilityCells): boolean {
  let changed = false
  for (const [layerId, layerCells] of cells.byLayer) {
    for (const [key, objects] of layerCells.cells) {
      const visible = cells.wanted.get(layerCells.category)?.has(key) ?? false
      for (const object of objects) {
        if (object.visible === visible) continue
        object.visible = visible
        changed = true
      }
    }
    if (layerCells.cells.size === 0) cells.byLayer.delete(layerId)
  }
  return changed
}

function visibilityIsCurrent(
  cells: ScatterVisibilityCells,
  x: number,
  z: number,
  reach: number,
): boolean {
  const current = cells.visibility
  return (
    current.revision === cells.revision &&
    current.x === x &&
    current.z === z &&
    current.reach === reach
  )
}

function rememberVisibility(
  cells: ScatterVisibilityCells,
  x: number,
  z: number,
  reach: number,
): void {
  cells.visibility.x = x
  cells.visibility.z = z
  cells.visibility.reach = reach
  cells.visibility.revision = cells.revision
}
