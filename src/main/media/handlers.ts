import { withoutSourcePath, type Asset } from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import type { ExternalFileImport } from '@shared/domain/externalFile'
import { taskRatio, type TaskWatch } from '@shared/domain/taskProgress'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { sendToSender } from '@main/ipc/broadcast'
import { parseAssetId } from '@main/assets/validation'
import { parseFolderPath } from '@main/project/validation'
import type { RunningTasks } from '@main/task/runningTasks'
import { assetTypeOf } from './link'
import type { MediaService } from './service'

export type MediaHandlerDeps = {
  media: MediaService
  /** Writes a catalogue row for a file left where it lies, and hands it back. */
  link: (source: string, type: Asset['type']) => Promise<Asset>
  /** The same, for a file the project already holds — see `adoptFile`. */
  adopt: (relative: string) => Promise<Asset | null>
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickMedia: () => Promise<string[]>
  capabilities: () => Promise<MediaCapabilities>
  importPaths: (
    paths: readonly string[],
    folder: string,
    watch: TaskWatch,
  ) => Promise<ExternalFileImport>
  claimExternalFiles: (id: string) => readonly string[]
  running: RunningTasks
}

export function registerMediaHandlers({
  media,
  link,
  adopt,
  pickMedia,
  capabilities,
  importPaths,
  claimExternalFiles,
  running,
}: MediaHandlerDeps): void {
  handle(CHANNELS.mediaAdopt, async (_event, relative) => {
    // A row the window never needs the absolute path of, exactly as the ingest answers.
    const asset = await adopt(parseFolderPath(relative))
    return asset && withoutSourcePath(asset)
  })

  handle(CHANNELS.mediaIngest, async () => {
    const assets: Asset[] = []

    for (const source of await pickMedia()) {
      const type = assetTypeOf(source)
      if (!type) continue

      const asset = await link(source, type)
      assets.push(withoutSourcePath(asset))
      // Not awaited: the row exists, so the browser shows the file at once, while probing a
      // twenty-minute rush goes on reporting through `evt:media-progress`.
      void media.ingest(asset.id, source, type)
    }

    return assets
  })

  handle(CHANNELS.mediaIngestPaths, async (event, requestId, folder, taskId) => {
    const paths = claimExternalFiles(requestId)
    return await running.run(taskId, async signal => {
      const imported = await importPaths(paths, parseFolderPath(folder), {
        signal,
        onStep: (done, total) =>
          sendToSender(event.sender, EVENTS.taskProgress, {
            id: taskId,
            ratio: taskRatio(done, total),
          }),
      })
      return { ...imported, assets: imported.assets.map(withoutSourcePath) }
    })
  })

  handle(CHANNELS.mediaCancel, (_event, assetId) => media.cancel(parseAssetId(assetId)))

  handle(CHANNELS.mediaAvailable, () => capabilities())
}
