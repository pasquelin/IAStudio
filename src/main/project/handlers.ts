import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CHANNELS } from '@shared/ipc'
import { PICTURES, withoutSourcePath } from '@shared/domain/asset'
import { assetFilePath, ownFileOf } from '@main/assets/protocol'
import { handle } from '@main/ipc/handle'
import { peaksFromBytes } from '@main/media/peaks'
import { isPngBytes, probePng } from '@main/media/png'
import { probeWav } from '@main/media/wav'
import type { LocalBackend } from '@main/assets/local-backend'
import type { FolderEditor, FolderReader } from './folder'
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
  parseSavePicture,
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
  /**
   * Whether a path is still there. Injected like everything else that touches the disk, and
   * needed because `reveal` answers nothing: a folder the shelf still lists but the disk has
   * lost would otherwise be a menu row that does nothing and explains nothing.
   */
  exists: (path: string) => boolean
  /** The project folder: read one level at a time, and the two gestures that write to it. */
  folder: FolderReader & FolderEditor
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
  exists,
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

  handle(CHANNELS.projectRevealFile, async (_event, relative) => {
    reveal(join(project.path(), parseFolderPath(relative)))
  })

  // An absolute path, unlike the one above: the home's shelf points at projects that are NOT
  // open, so there is no root to resolve against. `parseProjectPath` is the same refusal
  // `projectOpen` already applies to a path the renderer names — showing a folder opens nothing
  // and reads nothing, so this asks no more of the caller than opening it would.
  handle(CHANNELS.projectRevealFolder, async (_event, path) => {
    const folderPath = parseProjectPath(path)
    // Asked before showing, because `showItemInFolder` no-ops in silence on a path that has
    // gone — and the shelf lists folders that were last seen days ago.
    if (!exists(folderPath)) {
      record({ level: 'error', topic: 'project', messageKey: 'activity.projectNotRevealed' })
      return false
    }

    reveal(folderPath)
    return true
  })

  // All three answer whether it happened, and all three say why in the journal when it did not:
  // a gesture that does nothing and explains nothing is the worst of the three outcomes.
  handle(CHANNELS.projectRenameFile, async (_event, relative, name) => {
    const done = await folder.rename(parseFolderPath(relative), parseProjectName(name))
    if (!done) record({ level: 'error', topic: 'project', messageKey: 'activity.fileNotRenamed' })
    return done
  })

  handle(CHANNELS.projectMoveFile, async (_event, relative, folderPath) => {
    const done = await folder.move(parseFolderPath(relative), parseFolderPath(folderPath))
    if (!done) record({ level: 'error', topic: 'project', messageKey: 'activity.fileNotMoved' })
    return done
  })

  handle(CHANNELS.projectTrashFile, async (_event, relative) => {
    const done = await folder.trash(parseFolderPath(relative))
    if (!done) record({ level: 'error', topic: 'project', messageKey: 'activity.fileNotTrashed' })
    return done
  })

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

  handle(CHANNELS.assetsSavePicture, async (_event, value) => {
    const request = parseSavePicture(value)
    // Decoded here rather than in the renderer, exactly as the export is: a `Buffer` does not
    // cross the bridge, and base64 is what the extraction already produced.
    const png = Buffer.from(request.png, 'base64')
    // Checked on the bytes, which is the only place it can be: base64 says nothing about what it
    // encodes, and an encoder that answered with nothing would otherwise overwrite a picture
    // with a file that is not one.
    if (!isPngBytes(png)) throw new Error('expected a PNG payload')

    // Read from the bytes rather than carried over, exactly as `saveAudio` reads its own: a
    // picture is rarely the size it was, and a probe left behind describes the file that WAS
    // there. One that did outlived a 4112 × 2658 photo overwritten at 1024², and the inspector
    // went on announcing the dimensions of a picture nothing on disk held any more.
    const probe = probePng(png) ?? undefined

    // The same asset, edited — what ⌘S means on a document opened from one. `replaceBytes` keeps
    // the id, the name and the tags, and moves the extension with the bytes.
    if (request.replaces) {
      // Checked against the CATALOGUE, not against what was sent. `sourceAssetId` is read back
      // off a JSON envelope inside the project folder — user territory, like the manifest — and
      // `replaceBytes` builds its path from the row's own type: an id naming a take would write
      // `audio/<id>.png` and `rm` the `.wav` beside it, destroying a recording from a save on
      // another document entirely.
      const replaced = await project.catalog().find(request.replaces)
      if (!replaced || !PICTURES.includes(replaced.type)) {
        throw new Error(`asset ${request.replaces} is not a picture to overwrite`)
      }

      return withoutSourcePath(
        await assets.replaceBytes(request.replaces, png, PNG_EXTENSION, probe),
      )
    }

    // A picture saved beside its source inherits what the source IS: its kind, and the channel
    // it holds when it holds one. Read from the catalogue rather than sent by the renderer, for
    // the reason `saveTexture` gives — the kind is what the folder and the extension follow.
    const source = request.derivedFrom ? await project.catalog().find(request.derivedFrom) : null

    return withoutSourcePath(
      await assets.importFromBytes(
        {
          id: newAssetId(),
          name: request.name,
          type: source?.type ?? 'image',
          extension: PNG_EXTENSION,
          ...(probe ? { probe } : {}),
          ...(source?.map ? { map: source.map } : {}),
          ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
        },
        png,
      ),
    )
  })

  handle(CHANNELS.assetsSaveTexture, async (_event, value) => {
    const request = parseSaveTexture(value)
    // A channel is a picture on the shelf, so it owes its reader the same dimensions any other
    // one shows. Read from the bytes here, where they are already in hand.
    const probe = probePng(request.png) ?? undefined

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
          ...(probe ? { probe } : {}),
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
