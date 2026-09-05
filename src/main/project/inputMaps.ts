import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { INPUT_MAP_EXTENSION, inputMapOf, type InputMap } from '@shared/domain/inputMap'
import { isPrivatePath } from '@shared/domain/folder'
import { pathIsInside } from '@main/export/pathIsInside'
import { writeAtomic, writeQueue } from '@main/persistence'

export type InputMapStore = {
  write: (path: string, map: InputMap) => Promise<boolean>
}

export function createInputMaps(deps: { rootOf: () => string | null }): InputMapStore {
  const writes = writeQueue()

  return {
    write: async (path, map) => {
      const root = deps.rootOf()
      const file = root === null ? null : inputMapPath(root, path)
      if (file === null) return false

      inputMapOf(map)
      await mkdir(dirname(file), { recursive: true })
      await writes.next(() => writeAtomic(file, `${JSON.stringify(map, null, 2)}\n`))
      return true
    },
  }
}

function inputMapPath(root: string, path: string): string | null {
  if (isAbsolute(path) || !path.endsWith(INPUT_MAP_EXTENSION) || isPrivatePath(path)) return null
  const target = resolve(root, path)
  const within = relative(root, target)
  if (!pathIsInside(root, target) || isPrivatePath(within.split(sep).join('/'))) return null
  return target
}
