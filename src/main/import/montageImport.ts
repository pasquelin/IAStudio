import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { z } from 'zod'
import type { Asset } from '@shared/domain/asset'
import { taskRatio } from '@shared/domain/taskProgress'
import { safeFileName, stemOf } from '@shared/domain/fileName'
import { importSourceOf } from '@shared/domain/importRegistry'
import { CHANNELS, EVENTS } from '@shared/ipc'
import type { BundleClient } from '@main/bundle/bundleClient'
import { sendToSender } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import type { RunningTasks } from '@main/task/runningTasks'
import { folderInsideProject } from '@main/project/folderInsideProject'

export type MontageImportDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickImportPath: (extension: string) => Promise<string | null>
  /** Where the open project sits, or nothing when none is. */
  projectPath: () => string | null
  bundles: () => BundleClient
  running: RunningTasks
  /** Gives a landed file its catalogue row — the same door a double-click in the explorer uses. */
  adopt: (relative: string) => Promise<Asset | null>
}

/** The same id the window minted for the row, and the name the stop button answers to. */
const montageImport = z.object({ id: z.string().min(1).max(64) })

/** How many names are tried before giving up — a person with 64 copies has another problem. */
const MAX_TRIES = 64

/**
 * A folder inside the project this side just MADE, named after the bundle.
 *
 * Created here rather than tested for and made later: `mkdir` without `recursive` refuses a name
 * somebody holds, which is the only answer a case-insensitive volume and a race cannot both slip
 * through — and that refusal is what lets a stopped import remove the folder whole to undo.
 */
async function madeFolder(root: string, wanted: string): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    const name = attempt === 1 ? wanted : `${wanted} ${attempt}`
    const absolute = await folderInsideProject(root, name)
    if (!absolute) return null

    const failure = await mkdir(absolute).then(
      () => null,
      (error: NodeJS.ErrnoException) => error,
    )
    if (!failure) return name
    if (failure.code !== 'EEXIST') throw failure
  }
  return null
}

/**
 * Reading a montage bundle back into the project.
 *
 * What it reads WINS: the cut comes from the file, and the media are copied in and given
 * catalogue rows of their own rather than being pointed at where they lie. What the studio cannot
 * rebuild is `lossesImportingFrom`, said before the click rather than discovered afterwards.
 */
export function registerMontageImportHandlers({
  pickImportPath,
  projectPath,
  bundles,
  running,
  adopt,
}: MontageImportDeps): void {
  handle(CHANNELS.montageImport, async (event, request) => {
    const { id } = montageImport.parse(request)

    const root = projectPath()
    // The media are copied INTO the project, so without one there is nowhere for them to land.
    if (!root) return null

    // Named to the table BEFORE anything this run waits on, the dialog included, as the export
    // is: `cancel` answers `false` for an id it has not seen, so a stop reaching the handler
    // during the picker would be refused rather than obeyed.
    return running.run(id, async signal => {
      const archive = await pickImportPath(importSourceOf('montage.otioz').extension)
      if (!archive) return null
      // Asked again here: the folder below is made on disk, and a stop already given must not put
      // one in somebody's project for the moment it takes the reader to answer nothing.
      if (signal.aborted) return null

      const folder = await madeFolder(root, safeFileName(stemOf(basename(archive)), 'montage'))
      if (!folder) return null

      const into = join(root, folder)

      try {
        const contents = await bundles().read({
          path: archive,
          into,
          onStep: (done, total) =>
            sendToSender(event.sender, EVENTS.taskProgress, {
              id,
              ratio: taskRatio(done, total),
            }),
          signal,
        })

        // Stopped: the folder is this side's own, made a moment ago, so taking it away undoes the
        // whole import rather than leaving half a montage's rushes in somebody's project.
        if (!contents) {
          await rm(into, { recursive: true, force: true })
          return null
        }

        const media: { entry: string; assetId: string }[] = []
        for (const one of contents.media) {
          const asset = await adopt(`${folder}/${one.file}`)
          // A medium the studio has no editor for lands on disk and gets no row: the clip that
          // named it is dropped by `sequenceFromOtio`, which answers nothing for an unknown url.
          if (asset) media.push({ entry: one.entry, assetId: asset.id })
        }

        return { content: contents.content, media, folder }
      } catch (error) {
        await rm(into, { recursive: true, force: true })
        throw error
      }
    })
  })
}
