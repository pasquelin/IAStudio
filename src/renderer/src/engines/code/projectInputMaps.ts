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
    const known = new Set<string>()
    return maps
      .filter((map): map is InputMapModule => map !== null)
      .filter(input => !known.has(input.map.id) && known.add(input.map.id))
  } catch {
    return []
  }
}
