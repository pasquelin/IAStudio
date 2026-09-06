// SPDX-License-Identifier: MIT
import type { InputMapModule } from '@shared/domain/inputMap'
import { getBridge } from '@/services/bridge'
import { projectModulesOf } from './projectModules'

export async function projectInputMaps(): Promise<InputMapModule[]> {
  const read = await projectModulesOf(getBridge()?.inputMaps)

  return read.map(held => ({ path: held.path, map: held.value }))
}

export function inputMapIdConflict(maps: readonly InputMapModule[]): InputMapModule | null {
  const ids = new Set<string>()
  for (const map of maps) {
    if (ids.has(map.map.id)) return map
    ids.add(map.map.id)
  }
  return null
}
