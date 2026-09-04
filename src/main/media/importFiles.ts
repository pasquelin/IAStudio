import { constants, copyFile, unlink } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { ExternalFileImport } from '@shared/domain/externalFile'
import type { MontageImportResult } from '@shared/ipc'
import { foldForFileName } from '@shared/domain/fileName'
import { pathIn } from '@shared/domain/folder'
import { freeName } from '@main/project/filePlan'
import {
  IMPORTABLE_BUNDLE_EXTENSIONS,
  isImportableFile,
  importableAssetTypeOf,
} from '@shared/domain/importFormat'

export type ImportFilesDeps = {
  projectPath: () => string
  names: (folder: string) => Promise<readonly string[] | null>
  adopt: (relative: string) => Promise<Asset | null>
  documents: () => Promise<readonly DocumentDescriptor[]>
  importBundle: (source: string, folder: string) => Promise<MontageImportResult | null>
}

type ImportState = {
  taken: Set<string>
  assets: Asset[]
  montages: MontageImportResult[]
  refusedBundles: string[]
  documentPaths: Map<string, string>
}

async function importSource(
  source: string,
  folder: string,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  if (!isAbsolute(source) || !isImportableFile(source)) return
  const extension = extname(source).slice(1).toLowerCase()
  if (IMPORTABLE_BUNDLE_EXTENSIONS.includes(extension)) {
    const montage = await deps.importBundle(source, folder)
    if (montage) state.montages.push(montage)
    else state.refusedBundles.push(basename(source))
    return
  }

  const name = freeName(state.taken, basename(source))
  state.taken.add(foldForFileName(name))
  const relative = pathIn(folder, name)
  await copyFile(source, join(deps.projectPath(), relative), constants.COPYFILE_EXCL)
  if (importableAssetTypeOf(source)) {
    const asset = await deps.adopt(relative)
    if (asset) state.assets.push(asset)
  } else state.documentPaths.set(relative, name)
}

async function importedDocuments(state: ImportState, deps: ImportFilesDeps) {
  const listed = state.documentPaths.size > 0 ? await deps.documents() : []
  const documents = listed.filter(document => state.documentPaths.has(document.path))
  const accepted = new Set(documents.map(document => document.path))
  const refused = [...state.documentPaths]
    .filter(([relative]) => !accepted.has(relative))
    .map(([relative, name]) => ({ relative, name }))
  for (const file of refused) await unlink(join(deps.projectPath(), file.relative))
  return { documents, refused }
}

export async function importFiles(
  sources: readonly string[],
  folder: string,
  deps: ImportFilesDeps,
): Promise<ExternalFileImport> {
  const names = await deps.names(folder)
  if (names === null) return { assets: [], documents: [], montages: [], refused: [] }

  const state: ImportState = {
    taken: new Set(names.map(foldForFileName)),
    assets: [],
    montages: [],
    refusedBundles: [],
    documentPaths: new Map(),
  }
  for (const source of sources) await importSource(source, folder, deps, state)
  const { documents, refused } = await importedDocuments(state, deps)
  return {
    assets: state.assets,
    documents,
    montages: state.montages,
    refused: [
      ...refused.map(file => ({
        name: file.name,
        extension: extname(file.name).slice(1).toLowerCase(),
      })),
      ...state.refusedBundles.map(name => ({ name, extension: 'otioz' })),
    ],
  }
}
