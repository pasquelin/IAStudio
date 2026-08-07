import { readFile } from 'node:fs/promises'
import { CHANNELS } from '@shared/ipc'
import { withoutSourcePath } from '@shared/domain/asset'
import { assetFilePath, ownFileOf } from '@main/assets/protocol'
import { handle } from '@main/ipc/handle'
import { peaksFromBytes } from '@main/media/peaks'
import { probeWav } from '@main/media/wav'
import type { LocalBackend } from '@main/assets/local-backend'
import type { ProjectStore } from './store'
import {
  parseAssetId,
  parseAssetQuery,
  parseProjectName,
  parseProjectPath,
  parseSaveAudio,
} from './validation'

/** What `saveAudio` writes — the renderer encodes uncompressed PCM, never a codec. */
const WAV_EXTENSION = '.wav'

export type ProjectHandlerDeps = {
  project: ProjectStore
  /** Where an edited take is written back. Injected, like everything that touches the disk. */
  assets: LocalBackend
  newAssetId: () => string
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
  /** `shell.showItemInFolder`, injected for the same reason. */
  reveal: (file: string) => void
}

export function registerProjectHandlers({
  project,
  assets,
  newAssetId,
  pickFolder,
  reveal,
}: ProjectHandlerDeps): void {
  handle(CHANNELS.projectCreate, (_event, path, name) =>
    project.create(parseProjectPath(path), parseProjectName(name)),
  )

  handle(CHANNELS.projectOpen, (_event, path) => project.open(parseProjectPath(path)))

  handle(CHANNELS.projectCurrent, () => project.current())

  handle(CHANNELS.projectPickFolder, () => pickFolder())

  handle(CHANNELS.assetsSearch, async (_event, query) => {
    const found = await project.catalog().search(parseAssetQuery(query))
    return found.map(withoutSourcePath)
  })

  handle(CHANNELS.assetsReveal, async (_event, assetId) => {
    const asset = await project.catalog().find(parseAssetId(assetId))
    // Their file, not our proxy: showing someone `.index/proxies/ab12….mp4` in place of the
    // rush they linked is showing them a file they never made.
    const file = asset ? ownFileOf(project.path(), asset) : null
    if (!file) return false

    reveal(file)
    return true
  })

  handle(CHANNELS.assetsPeaks, async (_event, assetId) => {
    const asset = await project.catalog().find(parseAssetId(assetId))
    if (!asset?.peaksPath) return null

    // Through the same resolver the scheme uses: a stored path is user-editable territory.
    const file = assetFilePath(project.path(), asset.peaksPath)
    if (!file) return null

    try {
      return peaksFromBytes(await readFile(file))
    } catch {
      // A project folder can be moved or pruned under us; a clip without its waveform still
      // paints as a rectangle.
      return null
    }
  })

  handle(CHANNELS.assetsSaveAudio, async (_event, value) => {
    const request = parseSaveAudio(value)
    // Read from the bytes rather than carried over: an edited take is rarely the length it was.
    const probe = probeWav(request.wav) ?? undefined

    if (request.replaces) {
      return withoutSourcePath(
        await assets.replaceBytes(request.replaces, request.wav, WAV_EXTENSION, probe),
      )
    }

    return withoutSourcePath(
      await assets.importFromBytes(
        {
          id: newAssetId(),
          name: request.name,
          type: 'audio',
          extension: WAV_EXTENSION,
          ...(probe ? { probe } : {}),
          ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
        },
        request.wav,
      ),
    )
  })
}
