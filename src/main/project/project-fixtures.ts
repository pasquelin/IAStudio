import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { onTestFinished } from 'vitest'
import type { Project } from '@shared/domain/project'
import type { AsyncCatalog } from './catalog-client'
import { memoryCatalog } from './catalog-fixtures'
import { createDocumentFiles, type DocumentFiles } from './documents'
import { createProjectStore, type ProjectStore } from './store'

/** A real project on a real folder, and the pieces a test needs to reach into it. */
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
  const documents = createDocumentFiles({ projectPath: () => root, now: () => now })

  return { root, project, store, catalog, documents }
}

/**
 * One document, as a comparison sees it.
 *
 * `updatedAt` is left out on purpose: it is stamped by the write, so two runs of the same
 * project differ by it and by nothing else — a difference that would drown every real one.
 */
export type DocumentSnapshot = {
  fileName: string
  kind: string
  title: string
  content: string
}

/**
 * What a project holds, in a shape two runs can be held against each other.
 *
 * This is the measuring tool: read a project, do something to it, read it again, and compare
 * BEHAVIOUR rather than counting files. A migration that keeps every file and loses what one of
 * them held passes a file count and fails this.
 *
 * Sorted by file name, because `list` answers in the order the folder gave and that order is
 * not a promise.
 */
export async function snapshotDocuments(documents: DocumentFiles): Promise<DocumentSnapshot[]> {
  const read: DocumentSnapshot[] = []

  // In series, as `list` itself reads: a fixture project can hold thousands of documents, and
  // opening them all at once is what exhausts the file descriptors.
  for (const descriptor of await documents.list()) {
    const file = await documents.read(descriptor.id, descriptor.kind)
    read.push({
      fileName: descriptor.fileName,
      kind: descriptor.kind,
      title: descriptor.title,
      content: file?.content ?? '',
    })
  }

  return read.sort((one, other) => one.fileName.localeCompare(other.fileName, 'en'))
}
