import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  CATALOG_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  PROJECT_EXTENSION,
  PROJECT_FOLDERS,
  type Project,
} from '@shared/domain/project'
import { log } from '@main/log'
import type { AsyncCatalog } from './catalog-client'
import { parseManifest } from './validation'

/** Thrown when a channel needing a project is reached before one is open. */
export class NoProjectError extends Error {
  constructor() {
    super('no-project')
    this.name = 'NoProjectError'
  }
}

export type ProjectStoreDeps = {
  /** Resolves once the database is open and migrated — see `openCatalogThread`. */
  openCatalog: (file: string) => Promise<AsyncCatalog>
  now: () => string
  onChange: (project: Project | null) => void
  /** Writes out whatever still belongs to the project being closed, before its catalogue goes. */
  settle?: () => Promise<void>
}

export type ProjectStore = {
  create: (parentFolder: string, name: string) => Promise<Project>
  open: (path: string) => Promise<Project>
  current: () => Project | null
  /** The open project's folder. Throws rather than letting a write land outside a project. */
  path: () => string
  /** The open project's catalogue. Throws rather than answering an empty one. */
  catalog: () => AsyncCatalog
  close: () => void
}

async function ensureFolders(root: string): Promise<void> {
  await Promise.all(PROJECT_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
}

export function createProjectStore({
  openCatalog,
  now,
  onChange,
  settle,
}: ProjectStoreDeps): ProjectStore {
  let project: Project | null = null
  let catalog: AsyncCatalog | null = null

  const close = (): void => {
    // The thread is told to stop, but nothing waits for it: a project is closed from menus and
    // from IPC handlers that have no use for the moment a thread actually exits.
    void catalog?.close().catch((error: unknown) => {
      log.warn('project', `closing the catalogue failed: ${String(error)}`)
    })
    catalog = null
    project = null
  }

  /**
   * The new catalogue is opened before the current one is dropped. The other way round, a
   * database that fails to open — corrupt, locked, on a full disk — would leave the studio
   * with no project at all while the interface still showed the previous one as open.
   */
  const activate = async (opened: Project): Promise<Project> => {
    const file = join(opened.path, CATALOG_FILE)
    await mkdir(dirname(file), { recursive: true })

    const opening = await openCatalog(file)

    // Whatever is still queued belongs to the project that is closing, and its catalogue is
    // about to stop answering.
    await settle?.()

    close()
    catalog = opening
    project = opened
    onChange(opened)
    return opened
  }

  return {
    create: async (parentFolder, name) => {
      const root = join(parentFolder, `${name}${PROJECT_EXTENSION}`)
      await ensureFolders(root)

      const timestamp = now()
      const manifest = {
        version: MANIFEST_VERSION,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await writeFile(join(root, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf8')

      return await activate({ path: root, manifest })
    },

    open: async path => {
      const manifest = parseManifest(JSON.parse(await readFile(join(path, MANIFEST_FILE), 'utf8')))

      // Repairs a project whose subfolders were deleted between two sessions — the folder is
      // the user's, and a missing `assets/vid` must not stop it from opening.
      await ensureFolders(path)

      return await activate({ path, manifest })
    },

    current: () => project,

    path: () => {
      if (!project) throw new NoProjectError()
      return project.path
    },

    catalog: () => {
      if (!catalog) throw new NoProjectError()
      return catalog
    },

    close: () => {
      close()
      onChange(null)
    },
  }
}
