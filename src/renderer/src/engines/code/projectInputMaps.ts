// SPDX-License-Identifier: MIT
import type { InputMapModule } from '@shared/domain/inputMap'
import { getBridge } from '@/services/bridge'

async function readInputMap(path: string): Promise<InputMapModule | null> {
  try {
    const map = await getBridge()?.inputMaps.read(path)
    return map ? { path, map } : null
  } catch {
    return null
  }
}

export async function projectInputMaps(): Promise<InputMapModule[]> {
  try {
    const paths = await getBridge()?.inputMaps.list()
    if (!paths) return []
    const maps = await Promise.all(paths.map(readInputMap))
    return maps.filter((map): map is InputMapModule => map !== null)
  } catch {
    return []
  }
}

/**
 * The maps a game is handed, with any id already taken left out — the FIRST file wins. A duplicate
 * used to reach `createInputContexts`, which pushed the id twice and let the last one silently
 * decide every action; `inputMapIdConflict` names the file that was dropped.
 */
export function withoutDuplicateInputMapIds(
  maps: readonly InputMapModule[],
): readonly InputMapModule[] {
  const ids = new Set<string>()
  return maps.filter(one => {
    if (ids.has(one.map.id)) return false
    ids.add(one.map.id)
    return true
  })
}

/** Whether `id` is carried by more than one file — asked of ONE id, where the next finds any. */
export function isDuplicateInputMapId(maps: readonly InputMapModule[], id: string): boolean {
  return maps.filter(one => one.map.id === id).length > 1
}

export function inputMapIdConflict(maps: readonly InputMapModule[]): InputMapModule | null {
  const ids = new Set<string>()
  for (const map of maps) {
    if (ids.has(map.map.id)) return map
    ids.add(map.map.id)
  }
  return null
}
