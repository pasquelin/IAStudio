import { fileViewOf } from '@shared/domain/fileView'
import { INPUT_MAP_EXTENSION } from '@shared/domain/inputMap'
import { inputMapPreset, type InputPresetId } from '@shared/domain/inputPresets'
import { openFileView } from '@/features/shell/components/dockviewApi'
import { getBridge } from '@/services/bridge'

function availablePath(preset: InputPresetId, paths: readonly string[]): string {
  const occupied = new Set(paths.map(path => path.toLowerCase()))
  let copy = 1
  let path = `${preset}${INPUT_MAP_EXTENSION}`
  while (occupied.has(path.toLowerCase())) {
    copy += 1
    path = `${preset}-${copy}${INPUT_MAP_EXTENSION}`
  }
  return path
}

export async function createInputMapFromPreset(preset: InputPresetId): Promise<string | null> {
  const bridge = getBridge()
  if (!bridge) return null
  const path = availablePath(preset, await bridge.inputMaps.list())
  if (!(await bridge.inputMaps.write(path, structuredClone(inputMapPreset(preset))))) return null
  const view = fileViewOf(path)
  if (!view) return null
  openFileView(view)
  return path
}
