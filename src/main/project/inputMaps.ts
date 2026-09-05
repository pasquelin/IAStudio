import { mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { INPUT_MAP_EXTENSION, inputMapOf, type InputMap } from '@shared/domain/inputMap'
import { isPrivatePath, type FolderEntry } from '@shared/domain/folder'
import { byCodeUnit } from '@shared/text'
import { pathIsInside } from '@main/export/pathIsInside'
import { writeAtomic, writeQueue } from '@main/persistence'
import { fileInsideProject } from './fileInsideProject'

export type InputMapStore = {
  list: () => Promise<string[]>
  read: (path: string) => Promise<InputMap | null>
  write: (path: string, map: InputMap) => Promise<boolean>
}

export function createInputMaps(deps: {
  rootOf: () => string | null
  walk: () => Promise<FolderEntry[]>
}): InputMapStore {
  const writes = writeQueue()

  return {
    list: async () => {
      const root = deps.rootOf()
      if (root === null) return []
      return (await deps.walk())
        .filter(entry => entry.kind === 'file' && inputMapPath(root, entry.path))
        .map(entry => entry.path)
        .sort(byCodeUnit)
    },

    read: async path => {
      const root = deps.rootOf()
      if (root === null) return null
      const target = inputMapPath(root, path)
      const file = target === null ? null : await fileInsideProject(root, target)
      if (file === null) return null
      return inputMapOf(JSON.parse(await readFile(file, 'utf8')))
    },

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
