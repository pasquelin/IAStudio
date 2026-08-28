import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { ASSET_SEARCH_LIMIT_MAX, type Asset } from '@shared/domain/asset'
import { safeFileName } from '@shared/domain/fileName'
import { nameOf } from '@shared/domain/folder'
import type { GameExportOutcome, GameExportRequest } from '@shared/domain/gameExport'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { writeExportedGame, type ExportedAsset, type GameExportPorts } from './gameExport'
import { pathIsInside } from './pathIsInside'

export type GameExportDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
  projectPath: () => string | null
  /** The rows a catalogue holds, by id — where an asset's file sits inside the project. */
  assetsById: (ids: readonly string[]) => Promise<readonly Asset[]>
  /** Where the runtime bundle sits: `resources/gameRuntime` beside the app. */
  runtimeFolder: () => string
}

/** Writing a game that runs with no studio. The split is written on the channel, in `ipc.ts`. */
export function registerGameExportHandler(deps: GameExportDeps): void {
  handle(CHANNELS.gameExport, async (_event, request: GameExportRequest) => {
    // The project FIRST: asked the other way round, a person with none picked a folder and got
    // back the same `null` a cancel gives.
    const project = deps.projectPath()
    if (!project) return null

    const chosen = await deps.pickFolder()
    if (!chosen) return null

    const root = join(chosen, safeFileName(request.title, 'game'))
    const report = await writeExportedGame(portsFor(deps, project, root), request)

    // The NAME, never the path: where a folder sits is this side's business, as everywhere else.
    return { folder: basename(root), ...report } satisfies GameExportOutcome
  })
}

function portsFor(deps: GameExportDeps, project: string, root: string): GameExportPorts {
  return {
    assetFiles: async ids => {
      const found = new Map<string, ExportedAsset>()
      // One round trip, in slices the catalogue accepts — see `ASSET_SEARCH_LIMIT_MAX`.
      for (let at = 0; at < ids.length; at += ASSET_SEARCH_LIMIT_MAX) {
        for (const row of await deps.assetsById(ids.slice(at, at + ASSET_SEARCH_LIMIT_MAX))) {
          if (!row.path) continue

          try {
            const bytes = await readFile(join(project, row.path))
            found.set(row.id, { name: nameOf(row.path), bytes })
          } catch {
            // The row is in the catalogue and the file has gone: left out, and listed as missing.
          }
        }
      }
      return found
    },

    runtime: async () => {
      const folder = deps.runtimeFolder()
      let names: string[]
      try {
        // `withFileTypes`, and files only: the day the bundler emits a subfolder, a blind read
        // would report the EISDIR as « no runtime is built ».
        const found = await readdir(folder, { withFileTypes: true })
        names = found.filter(one => one.isFile()).map(one => one.name)
      } catch {
        // 🛑 In development the folder exists only once `pnpm game:runtime` has run, and git
        // ignores it. Said as a game with no runtime rather than as a bare ENOENT over the wire.
        throw new Error('no game runtime is built: run `pnpm game:runtime`')
      }

      return await Promise.all(
        names.map(async name => ({ name, body: await readFile(join(folder, name)) })),
      )
    },

    write: async (relative, body) => {
      const file = join(root, relative)
      // 🛑 The second lock, and the one that does not depend on who composed the name: `join`
      // resolves `..`, so a path that climbed out of the folder is refused here whatever the
      // caller thought it was writing.
      if (!pathIsInside(root, file)) {
        throw new Error(`refused to write outside the game folder: ${relative}`)
      }
      // `recursive`, as `export/folder.ts` does and for the same reason.
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, body)
    },
  }
}
