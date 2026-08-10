import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CHANNELS } from '@shared/ipc'
import { withoutSourcePath } from '@shared/domain/asset'
import { assetFilePath, ownFileOf } from '@main/assets/protocol'
import { handle } from '@main/ipc/handle'
import { peaksFromBytes } from '@main/media/peaks'
import { probeWav } from '@main/media/wav'
import type { LocalBackend } from '@main/assets/local-backend'
import type { FolderReader } from './folder'
import type { ActivityReport } from './activity-log'
import { askCloseChoice, askDeleteDocument, type AskUser } from './document-dialogs'
import type { DocumentFiles } from './documents'
import { openFailureKey, type ProjectStore } from './store'
import {
  parseAssetId,
  parseAssetQuery,
  parseDocumentDraft,
  parseDocumentId,
  parseDocumentKind,
  parseDocumentTitle,
  parseFolderPath,
  parseProjectName,
  parseProjectPath,
  parseSaveAudio,
  parseSaveTexture,
} from './validation'

/** What `saveAudio` writes — the renderer encodes uncompressed PCM, never a codec. */
const WAV_EXTENSION = '.wav'

/** What `saveTexture` writes. Lossless, because a channel is data before it is a picture. */
const PNG_EXTENSION = '.png'

export type ProjectHandlerDeps = {
  project: ProjectStore
  /** The journal's own `record`, injected as every other consumer of it takes it. */
  record: (entry: ActivityReport) => void
  /** Where an edited take is written back. Injected, like everything that touches the disk. */
  assets: LocalBackend
  newAssetId: () => string
  documents: DocumentFiles
  /** `shell.showItemInFolder`, injected rather than imported: it needs a live app. */
  reveal: (file: string) => void
  /** The project folder, read one level at a time for the explorer. */
  folder: FolderReader
  /**
   * `shell.openPath`, which answers an empty string on success and a sentence on failure — and
   * this is the only place the studio launches a third-party application, so it is injected
   * like every other thing that leaves the process.
   */
  openInSystem: (file: string) => Promise<string>
  /** `dialog.showMessageBox`, injected for the same reason — see `document-dialogs`. */
  askUser: AskUser
}

export function registerProjectHandlers({
  project,
  record,
  assets,
  newAssetId,
  documents,
  reveal,
  folder,
  openInSystem,
  askUser,
}: ProjectHandlerDeps): void {
  handle(CHANNELS.projectCreate, async (_event, path, name) => {
    // Parsed outside the try on purpose: an argument this channel refuses is not a sentence
    // about the folder, and `projectOpen` below draws the same line through `openFailureKey`.
    const parent = parseProjectPath(path)
    const named = parseProjectName(name)

    try {
      return await project.create(parent, named)
    } catch (error) {
      // Same silence as opening: `createPicked` watches nothing either, so a folder that could
      // not be written said nothing at all. The path is left out — the user picked it from a
      // dialog, and whatever `mkdir` says about it is not something they can act on.
      record({ level: 'error', topic: 'project', messageKey: 'activity.projectNotCreated' })
      throw error
    }
  })

  handle(CHANNELS.projectOpen, async (_event, path) => {
    try {
      return await project.open(parseProjectPath(path))
    } catch (error) {
      // Said out loud on the way past: the journal is the studio's error surface, and the
      // renderer's own `openPicked` watches nothing. Rethrown all the same — `open` only knows
      // to forget a folder when the promise rejects.
      const messageKey = openFailureKey(error)
      if (messageKey) record({ level: 'error', topic: 'project', messageKey })
      throw error
    }
  })

  handle(CHANNELS.projectCurrent, () => project.current())

  // `async`, though it awaits nothing of its own: a refused path throws from `parseFolderPath`,
  // and a synchronous throw here would reach the caller as an exception rather than a rejected
  // invoke — which is not what the other side is written to catch.
  handle(CHANNELS.projectListFolder, async (_event, relative) =>
    folder.list(parseFolderPath(relative)),
  )

  handle(CHANNELS.projectOpenFile, async (_event, relative) => {
    const failure = await openInSystem(join(project.path(), parseFolderPath(relative)))
    // `shell.openPath` answers with a sentence rather than throwing, and that sentence is the
    // system's, in the system's language. What reaches the journal is ours; what it says is
    // written on the console, where a support question can find it.
    if (failure) record({ level: 'error', topic: 'project', messageKey: 'activity.fileNotOpened' })
    return failure === ''
  })

  handle(CHANNELS.assetsSearch, async (_event, query) => {
    const found = await project.catalog().search(parseAssetQuery(query))
    return found.map(withoutSourcePath)
  })

  handle(CHANNELS.assetsCounts, () => project.catalog().countByType())

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

  handle(CHANNELS.assetsSaveTexture, async (_event, value) => {
    const request = parseSaveTexture(value)

    return withoutSourcePath(
      await assets.importFromBytes(
        {
          id: newAssetId(),
          name: request.name,
          // A channel is a texture in the catalogue, which is what puts it under the right
          // facet of the shelf and what `PICTURES` then lets a tile show. Decided here and
          // never sent by the renderer: the kind is what the extension and the folder follow.
          type: 'texture',
          extension: PNG_EXTENSION,
          map: request.map,
          ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
        },
        request.png,
      ),
    )
  })

  handle(CHANNELS.documentList, () => documents.list())

  handle(CHANNELS.documentRead, (_event, id, kind) =>
    documents.read(parseDocumentId(id), parseDocumentKind(kind)),
  )

  handle(CHANNELS.documentWrite, async (_event, id, kind, draft) => {
    await documents.write(parseDocumentId(id), parseDocumentKind(kind), parseDocumentDraft(draft))
    // After the save, never before: a manifest stamped for a document the disk refused would
    // say the project worked when nothing was written.
    project.touch()
  })

  handle(CHANNELS.documentRemove, (_event, id, kind) =>
    documents.remove(parseDocumentId(id), parseDocumentKind(kind)),
  )

  handle(CHANNELS.documentConfirmClose, (_event, title) =>
    askCloseChoice(askUser, parseDocumentTitle(title)),
  )

  handle(CHANNELS.documentConfirmDelete, (_event, title) =>
    askDeleteDocument(askUser, parseDocumentTitle(title)),
  )
}
