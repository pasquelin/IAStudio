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
import { createCatalog, type Catalog } from './catalog'
import type { SqliteDriver } from './sqlite'
import { parseManifest } from './validation'

/** Thrown when a channel needing a project is reached before one is open. */
export class NoProjectError extends Error {
  constructor() {
    super('no-project')
    this.name = 'NoProjectError'
  }
}

export type ProjectStoreDeps = {
  openDatabase: (file: string) => SqliteDriver
  now: () => string
  onChange: (project: Project | null) => void
}

export type ProjectStore = {
  create: (parentFolder: string, name: string) => Promise<Project>
  open: (path: string) => Promise<Project>
  current: () => Project | null
  /** The open project's folder. Throws rather than letting a write land outside a project. */
  path: () => string
  /** The open project's catalogue. Throws rather than answering an empty one. */
  catalog: () => Catalog
  close: () => void
}

async function ensureFolders(root: string): Promise<void> {
  await Promise.all(PROJECT_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
}

export function createProjectStore({
  openDatabase,
  now,
  onChange,
}: ProjectStoreDeps): ProjectStore {
  let project: Project | null = null
  let catalog: Catalog | null = null

  const close = (): void => {
    catalog?.close()
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

    const opening = createCatalog(openDatabase(file))

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
