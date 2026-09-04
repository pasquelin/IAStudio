import { realpath } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { ExternalFileImport, ExternalFileRefusal } from '@shared/domain/externalFile'
import type { MontageImportResult } from '@shared/ipc'
import type { TaskWatch } from '@shared/domain/taskProgress'
import { orElse } from '@shared/promises'
import { foldForFileName } from '@shared/domain/fileName'
import { pathIn } from '@shared/domain/folder'
import { freeName } from '@main/project/filePlan'
import { folderInsideProject } from '@main/project/folderInsideProject'
import { copyExternalFile, removeExternalCopy } from './copyExternalFile'
import {
  IMPORTABLE_BUNDLE_EXTENSIONS,
  IMPORTABLE_DOCUMENT_EXTENSIONS,
  isImportableFile,
  importableAssetTypeOf,
} from '@shared/domain/importFormat'

export type ImportFilesDeps = {
  projectPath: () => string
  names: (folder: string) => Promise<readonly string[] | null>
  adopt: (relative: string) => Promise<Asset | null>
  documents: () => Promise<readonly DocumentDescriptor[]>
  importBundle: (
    source: string,
    root: string,
    folder: string,
    watch: TaskWatch,
  ) => Promise<MontageImportResult | null>
}

type ImportState = {
  taken: Set<string>
  assets: Asset[]
  montages: MontageImportResult[]
  refusedBundles: ExternalFileRefusal[]
  documentPaths: Map<string, string>
  failed: string[]
}

const emptyImport = (failed: readonly string[] = []): ExternalFileImport => ({
  assets: [],
  documents: [],
  montages: [],
  refused: [],
  failed,
})

const importFolder = (root: string, folder: string): Promise<string | null> =>
  folder === '' ? orElse(realpath(root), null) : folderInsideProject(root, folder)

async function importSource(
  source: string,
  root: string,
  folder: string,
  target: string,
  watch: TaskWatch,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  if (!isAbsolute(source) || !isImportableFile(source)) return
  const extension = extname(source).slice(1).toLowerCase()
  if (IMPORTABLE_BUNDLE_EXTENSIONS.includes(extension)) {
    return importBundle(source, root, folder, extension, watch, deps, state)
  }
  await importAssetOrDocument(source, target, folder, extension, watch, deps, state)
}

async function importBundle(
  source: string,
  root: string,
  folder: string,
  extension: string,
  watch: TaskWatch,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  const montage = await deps.importBundle(source, root, folder, watch)
  if (montage) state.montages.push(montage)
  else if (!watch.signal?.aborted) state.refusedBundles.push({ name: basename(source), extension })
}

async function importAssetOrDocument(
  source: string,
  target: string,
  folder: string,
  extension: string,
  watch: TaskWatch,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  const sourceName = basename(source)
  const suffix = extname(sourceName)
  const canonicalName = IMPORTABLE_DOCUMENT_EXTENSIONS.includes(extension)
    ? `${sourceName.slice(0, -suffix.length)}.${extension}`
    : sourceName
  const name = freeName(state.taken, canonicalName)
  state.taken.add(foldForFileName(name))
  const relative = pathIn(folder, name)
  const destination = join(target, name)
  if (!(await copyExternalFile(source, destination, watch))) return
  try {
    if (IMPORTABLE_DOCUMENT_EXTENSIONS.includes(extension)) {
      // The name the user DROPPED, not the free one its copy took: both notices this feeds —
      // refused and failed — name a file that is no longer on disk under either.
      state.documentPaths.set(relative, sourceName)
      return
    }
    if (importableAssetTypeOf(source)) {
      const asset = await deps.adopt(relative)
      if (asset) state.assets.push(asset)
    }
  } catch (error) {
    await removeExternalCopy(destination)
    throw error
  }
}

async function importedDocuments(state: ImportState, deps: ImportFilesDeps, root: string) {
  try {
    const listed = state.documentPaths.size > 0 ? await deps.documents() : []
    const documents = listed.filter(document => state.documentPaths.has(document.path))
    const accepted = new Set(documents.map(document => document.path))
    const refused = [...state.documentPaths]
      .filter(([relative]) => !accepted.has(relative))
      .map(([relative, name]) => ({ relative, name }))
    for (const file of refused) await removeExternalCopy(join(root, file.relative))
    return { documents, refused }
  } catch {
    for (const [relative] of state.documentPaths) {
      await removeExternalCopy(join(root, relative))
    }
    state.failed.push(...state.documentPaths.values())
    return { documents: [], refused: [] }
  }
}

export async function importFiles(
  sources: readonly string[],
  folder: string,
  deps: ImportFilesDeps,
  watch: TaskWatch = {},
): Promise<ExternalFileImport> {
  const root = deps.projectPath()
  const target = await importFolder(root, folder)
  if (!target) return emptyImport(sources.map(source => basename(source)))
  const names = await deps.names(folder)
  if (names === null) return emptyImport(sources.map(source => basename(source)))

  const state: ImportState = {
    taken: new Set(names.map(foldForFileName)),
    assets: [],
    montages: [],
    refusedBundles: [],
    documentPaths: new Map(),
    failed: [],
  }
  for (const source of sources) {
    if (watch.signal?.aborted) break
    try {
      await importSource(source, root, folder, target, watch, deps, state)
    } catch {
      if (!watch.signal?.aborted) state.failed.push(basename(source))
    }
  }
  const { documents, refused } = await importedDocuments(state, deps, root)
  return {
    assets: state.assets,
    documents,
    montages: state.montages,
    refused: [
      ...refused.map(file => ({
        name: file.name,
        extension: extname(file.name).slice(1).toLowerCase(),
      })),
      ...state.refusedBundles,
    ],
    failed: state.failed,
  }
}
