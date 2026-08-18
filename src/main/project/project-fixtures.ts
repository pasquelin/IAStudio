import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { onTestFinished } from 'vitest'
import type { DocumentKind } from '@shared/domain/document'
import type { Project } from '@shared/domain/project'
import type { AsyncCatalog } from './catalogClient'
import { memoryCatalog } from './catalog-fixtures'
import { createDocumentFiles, type DocumentFiles } from './documents'
import { createFolderReader } from './folder'
import { createProjectStore, type ProjectStore } from './store'

/** A real project on a real folder, and the pieces a test needs to reach into it. */
/**
 * The document reader over a folder a test names, composed as `services.ts` composes it.
 *
 * The real folder reader and not a stub: a listing IS a walk now, and a test reading documents
 * through anything else would be measuring a second implementation. `'en'` because the language
 * only settles how names are ordered, and this reader's own order is taken by code unit.
 */
export function documentFilesAt(root: string, now: string): DocumentFiles {
  const reader = createFolderReader(
    () => root,
    () => 'en',
  )

  return createDocumentFiles({
    projectPath: () => root,
    now: () => now,
    walkFiles: () => reader.walk(),
    folderNames: relative => reader.names(relative),
  })
}

export type TempProject = {
  /** The project folder. Absolute, and gone when the test finishes. */
  root: string
  project: Project
  store: ProjectStore
  catalog: AsyncCatalog
  documents: DocumentFiles
}

/**
 * A project written to a temporary folder, cleaned up when the test finishes.
 *
 * Six suites spell this out by hand today — `mkdtemp`, `createProjectStore`, `create`, and an
 * `afterEach` that removes the folder — which is four chances to forget the last one.
 *
 * The DISK is temporary; the catalogue is in memory. That split is the convention the project
 * suites already follow: the SQL has its own tests, and a project test has no reason to leave a
 * database file behind. `no-unclosed-memory-database` is answered here rather than by each
 * caller, which is the other thing a helper is for.
 *
 * `now` is fixed rather than read from the clock, so a snapshot taken twice matches.
 */
export async function withTempProject(
  name = 'Fixture',
  now = '2026-08-16T10:00:00.000Z',
): Promise<TempProject> {
  const root = await mkdtemp(join(tmpdir(), 'scenario-fixture-'))
  const catalog = memoryCatalog()

  const store = createProjectStore({
    openCatalog: async () => catalog,
    now: () => now,
    onChange: () => {},
  })

  onTestFinished(async () => {
    store.close()
    await rm(root, { recursive: true, force: true })
  })

  const project = await store.create(root, name)
  const documents = documentFilesAt(root, now)

  return { root, project, store, catalog, documents }
}

/**
 * One document, as a comparison sees it.
 *
 * `updatedAt` is left out on purpose: it is stamped by the write, so two runs of the same
 * project differ by it and by nothing else — a difference that would drown every real one.
 */
export type DocumentSnapshot = {
  path: string
  kind: DocumentKind
  title: string
  content: string
  /**
   * The files beside the content — one PNG per layer of an image document.
   *
   * Without them this tool would miss the very loss it exists to catch: a migration that dropped
   * every layer of an `.img` while keeping its manifest would leave `content` untouched and the
   * snapshot identical.
   */
  parts: readonly { name: string; data: string }[]
}

/**
 * What a project holds, in a shape two runs can be held against each other.
 *
 * This is the measuring tool: read a project, do something to it, read it again, and compare
 * BEHAVIOUR rather than counting files. A migration that keeps every file and loses what one of
 * them held passes a file count and fails this.
 *
 * Sorted by path, because `list` answers in the order the walk gave and that order is not a
 * promise.
 */
export async function snapshotDocuments(documents: DocumentFiles): Promise<DocumentSnapshot[]> {
  const read: DocumentSnapshot[] = []

  // In series, as `list` itself reads: a fixture project can hold thousands of documents, and
  // opening them all at once is what exhausts the file descriptors.
  for (const descriptor of await documents.list()) {
    const file = await documents.read(descriptor.id, descriptor.kind)
    read.push({
      path: descriptor.path,
      kind: descriptor.kind,
      title: descriptor.title,
      content: file?.content ?? '',
      // Sorted for the reason the documents themselves are: a folder answers in its own order,
      // and that order is not a promise either.
      parts: [...(file?.parts ?? [])].sort((one, other) =>
        one.name.localeCompare(other.name, 'en'),
      ),
    })
  }

  return read.sort((one, other) => one.path.localeCompare(other.path, 'en'))
}
