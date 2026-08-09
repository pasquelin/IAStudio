import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import {
  CATALOG_FILE,
  MANIFEST_FILE,
  MANIFEST_VERSION,
  LEGACY_MANIFEST_FILE,
  PROJECT_FOLDERS,
  type Project,
} from '@shared/domain/project'
import { log } from '@main/log'
import { isMissing } from '@main/scenario/job-store'
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

const execFile = promisify(execFileCallback)

async function ensureFolders(root: string): Promise<void> {
  await Promise.all(PROJECT_FOLDERS.map(folder => mkdir(join(root, folder), { recursive: true })))
  await hideFromExplorer(join(root, '.index'))
}

/**
 * A leading dot hides on macOS and Linux and means nothing on Windows, which reads the
 * FILE_ATTRIBUTE_HIDDEN bit that Node does not expose. `attrib` is the only way to set it
 * without a native module, and it costs one short process per project rather than per file.
 *
 * Failures are swallowed on purpose: a manifest the Explorer happens to show is a cosmetic
 * problem, and refusing to open the project over it would be a real one.
 */
async function hideFromExplorer(path: string): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    await execFile('attrib', ['+h', path])
  } catch {
    return
  }
}

/**
 * The manifest, under whichever name the folder carries it, migrated to the hidden one as it is
 * read. The dotted file wins when both are there: a project opened once since the rename keeps
 * the old one beside it, and the stale copy must not be what the studio believes.
 *
 * The old file is left where it is rather than deleted — a folder the user may be syncing is
 * not ours to tidy, and an older build of the studio still reads it.
 */
async function readManifest(path: string): Promise<string> {
  try {
    return await readFile(join(path, MANIFEST_FILE), 'utf8')
  } catch (error) {
    // Only an ABSENT file means "made before the rename". Any other failure — permissions, a
    // folder in its place, a sync placeholder — is a manifest that exists, and taking it for a
    // missing one would overwrite it with the stale copy beside it.
    if (!isMissing(error)) throw error

    const legacy = await readFile(join(path, LEGACY_MANIFEST_FILE), 'utf8')

    // Best effort: a read-only folder still opens, it just migrates on the next writable one.
    await writeFile(join(path, MANIFEST_FILE), legacy, 'utf8').catch(() => undefined)
    await hideFromExplorer(join(path, MANIFEST_FILE))

    return legacy
  }
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
      const root = join(parentFolder, name)
      await ensureFolders(root)

      const timestamp = now()
      const manifest = {
        version: MANIFEST_VERSION,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await writeFile(join(root, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf8')
      await hideFromExplorer(join(root, MANIFEST_FILE))

      return await activate({ path: root, manifest })
    },

    open: async path => {
      const manifest = parseManifest(JSON.parse(await readManifest(path)))

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
