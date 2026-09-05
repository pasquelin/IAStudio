import { mkdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { ExternalFileImport, ExternalFileRefusal } from '@shared/domain/externalFile'
import type { MontageImportResult } from '@shared/ipc'
import type { TaskWatch } from '@shared/domain/taskProgress'
import { orElse } from '@shared/promises'
import { foldForFileName } from '@shared/domain/fileName'
import { pathIn } from '@shared/domain/folder'
import { documentReferencesOf, SCANNED_BYTES } from '@shared/domain/documentReferences'
import { freeName } from '@main/project/filePlan'
import { folderInsideProject } from '@main/project/folderInsideProject'
import { copyExternalFile, removeExternalCopy, removeExternalFolder } from './copyExternalFile'
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
  /** The folder a document with siblings owns, which a refusal removes instead of the file. */
  documentFolders: Map<string, string>
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

/** The files the source points at, read off its own text — none for a file too big to hold one. */
async function referencesOf(source: string, extension: string): Promise<readonly string[]> {
  const size = (await orElse(stat(source), null))?.size ?? 0
  if (size === 0 || size > SCANNED_BYTES) return []
  const text = await orElse(readFile(source, 'utf8'), null)
  return text === null ? [] : documentReferencesOf(extension, text)
}

/** Where a copy lands, and whether it brought a folder of its own with it. */
type Landing = { nest: string; into: string; relative: string; destination: string }

/**
 * A document that points at siblings takes a folder of its own: its references keep the spelling
 * the file holds, so nothing rewrites it and no neighbour collides with what the project has.
 */
function landingFor(
  canonicalName: string,
  stem: string,
  nested: boolean,
  target: string,
  folder: string,
  state: ImportState,
): Landing {
  const nest = nested ? freeName(state.taken, stem) : ''
  const name = nest === '' ? freeName(state.taken, canonicalName) : canonicalName
  state.taken.add(foldForFileName(nest === '' ? name : nest))
  const into = nest === '' ? target : join(target, nest)
  return {
    nest,
    into,
    relative: pathIn(folder, nest === '' ? name : `${nest}/${name}`),
    destination: join(into, name),
  }
}

/**
 * The siblings, beside the document and under their own spelling — so nothing rewrites the file.
 *
 * A picture is ADOPTED as well as copied: a sky and a material relink through the catalogue
 * (`assetIdOf`), so one that is merely on disk leaves the document without its texture.
 */
async function copyNeighbours(
  source: string,
  references: readonly string[],
  landing: Landing,
  folder: string,
  watch: TaskWatch,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  const from = dirname(source)
  for (const reference of references) {
    if (watch.signal?.aborted) return
    const destination = join(landing.into, reference)
    await mkdir(dirname(destination), { recursive: true })
    const copied = await orElse(
      copyExternalFile(resolve(from, reference), destination, watch),
      false,
    )
    if (!copied) {
      state.failed.push(basename(reference))
      continue
    }
    if (!importableAssetTypeOf(reference)) continue
    const asset = await deps.adopt(pathIn(folder, `${landing.nest}/${reference}`))
    if (asset) state.assets.push(asset)
  }
}

/** What a copy that landed becomes: a document to be listed, or a row of the catalogue. */
async function landed(
  source: string,
  references: readonly string[],
  landing: Landing,
  folder: string,
  isDocument: boolean,
  watch: TaskWatch,
  deps: ImportFilesDeps,
  state: ImportState,
): Promise<void> {
  if (!isDocument) {
    if (!importableAssetTypeOf(source)) return
    const asset = await deps.adopt(landing.relative)
    if (asset) state.assets.push(asset)
    return
  }
  if (landing.nest !== '') {
    state.documentFolders.set(landing.relative, pathIn(folder, landing.nest))
    await copyNeighbours(source, references, landing, folder, watch, deps, state)
    // A cancelled import leaves nothing half-written: neighbours stop where they are, so the
    // folder goes with them rather than being listed as a document missing most of its parts.
    if (watch.signal?.aborted) {
      state.documentFolders.delete(landing.relative)
      return await removeExternalFolder(landing.into)
    }
  }
  // The name the user DROPPED, not the free one its copy took: both notices this feeds —
  // refused and failed — name a file that is no longer on disk under either.
  state.documentPaths.set(landing.relative, basename(source))
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
  const stem = sourceName.slice(0, -extname(sourceName).length)
  const isDocument = IMPORTABLE_DOCUMENT_EXTENSIONS.includes(extension)
  const references = isDocument ? await referencesOf(source, extension) : []
  const landing = landingFor(
    isDocument ? `${stem}.${extension}` : sourceName,
    stem,
    references.length > 0,
    target,
    folder,
    state,
  )

  if (landing.nest !== '') await mkdir(landing.into, { recursive: true })
  if (!(await copyExternalFile(source, landing.destination, watch))) {
    if (landing.nest !== '') await removeExternalFolder(landing.into)
    return
  }

  try {
    await landed(source, references, landing, folder, isDocument, watch, deps, state)
  } catch (error) {
    if (landing.nest === '') await removeExternalCopy(landing.destination)
    else await removeExternalFolder(landing.into)
    throw error
  }
}

const removeImported = async (
  root: string,
  relative: string,
  state: ImportState,
): Promise<void> => {
  const held = state.documentFolders.get(relative)
  if (held !== undefined) return await removeExternalFolder(join(root, held))
  await removeExternalCopy(join(root, relative))
}

async function importedDocuments(state: ImportState, deps: ImportFilesDeps, root: string) {
  try {
    const listed = state.documentPaths.size > 0 ? await deps.documents() : []
    const documents = listed.filter(document => state.documentPaths.has(document.path))
    const accepted = new Set(documents.map(document => document.path))
    const refused = [...state.documentPaths]
      .filter(([relative]) => !accepted.has(relative))
      .map(([relative, name]) => ({ relative, name }))
    for (const file of refused) await removeImported(root, file.relative, state)
    return { documents, refused }
  } catch {
    for (const [relative] of state.documentPaths) await removeImported(root, relative, state)
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
    documentFolders: new Map(),
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
