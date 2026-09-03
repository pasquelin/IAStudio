import { constants, copyFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import { foldForFileName } from '@shared/domain/fileName'
import { pathIn } from '@shared/domain/folder'
import { freeName } from '@main/project/filePlan'
import { sourceNatureOf } from '@shared/domain/fileRole'

export type ImportFilesDeps = {
  projectPath: () => string
  names: (folder: string) => Promise<readonly string[] | null>
  adopt: (relative: string) => Promise<Asset | null>
}

export async function importFiles(
  sources: readonly string[],
  folder: string,
  deps: ImportFilesDeps,
): Promise<Asset[]> {
  const names = await deps.names(folder)
  if (names === null) return []

  const taken = new Set(names.map(foldForFileName))
  const imported: Asset[] = []

  for (const source of sources) {
    if (!isAbsolute(source) || !sourceNatureOf(source).openable) continue
    const name = freeName(taken, basename(source))
    taken.add(foldForFileName(name))
    const relative = pathIn(folder, name)
    await copyFile(source, join(deps.projectPath(), relative), constants.COPYFILE_EXCL)
    const asset = await deps.adopt(relative)
    if (asset) imported.push(asset)
  }

  return imported
}
