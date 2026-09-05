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

export function inputMapIdConflict(maps: readonly InputMapModule[]): InputMapModule | null {
  const ids = new Set<string>()
  for (const map of maps) {
    if (ids.has(map.map.id)) return map
    ids.add(map.map.id)
  }
  return null
}
