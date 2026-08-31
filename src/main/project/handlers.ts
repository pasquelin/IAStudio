import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { projectName } from '@shared/domain/project'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { PICTURES, withoutSourcePath, type Asset, type MediaProbe } from '@shared/domain/asset'
import type { FileOutcome } from '@shared/domain/fileOp'
import { assetFilePath, ownFileOf } from '@main/assets/protocol'
import type { TextureExtraction } from '@main/assets/textureExtraction'
import { parseAssetId, parseAssetIds } from '@main/assets/validation'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import { peaksFromBytes } from '@main/media/peaks'
import { isPngBytes, probePng } from '@main/media/png'
import { packOpenRaster, unpackOpenRaster } from '@main/assets/openRasterFile'
import { oraThumbnailOf } from '@main/media/oraThumbnail'
import { ORA_MERGED_PATH } from '@shared/domain/openRaster'
import { probeWav } from '@main/media/wav'
import type { LocalBackend } from '@main/assets/localBackend'
import { fileFactsOf } from './fileFacts'
import type { FileOps } from './fileOps'
import type { GameScriptStore } from './gameScripts'
import type { ProjectGameStore } from './game'
import type { FolderReader } from './folder'
import type { Reconciler } from './reconcile'
import type { ActivityReport } from './activityLog'
import {
  askCloseChoice,
  askDeleteDocument,
  askFlattenDocument,
  askOverwriteDocument,
  type AskUser,
} from './documentDialogs'
import type { DocumentFiles } from './documents'
import { askLeaveWithJobs, askTrashFiles, askUseOccupiedFolder } from './projectDialogs'
import type { ProjectContextStore } from './context'
import { openFailureKey, type ProjectStore } from './store'
import {
  parseAssetQuery,
  parseContextCards,
  parseDocumentDraft,
  parseDocumentId,
  parseDocumentKind,
  parseDocumentTitle,
  parseFolderPath,
  parseFolderRole,
  parseFolderPaths,
  parseForceWrite,
  parseHiddenShown,
  parseLandingFolder,
  parseProjectName,
  parseProjectPath,
  parseProjectTitle,
  parseSaveAudio,
  parseSaveLayered,
  parseSavePicture,
  parseGame,
  parseSaveTexture,
  parseSearchTerm,
} from './validation'

/** What `saveAudio` writes — the renderer encodes uncompressed PCM, never a codec. */
const WAV_EXTENSION = '.wav'

/** What `saveTexture` writes. Lossless, because a channel is data before it is a picture. */
const PNG_EXTENSION = '.png'

/** What `saveLayered` writes: OpenRaster, the open container for a stack. */
const ORA_EXTENSION = '.ora'

export type ProjectHandlerDeps = {
  project: ProjectStore
  /** The journal's own `record`, injected as every other consumer of it takes it. */
  record: (entry: ActivityReport) => void
  /** Where an edited take is written back. Injected, like everything that touches the disk. */
  assets: LocalBackend
  /**
   * A model's own pictures, taken out into the project. The same one an import runs on its own,
   * so the menu row and the automatic path can never disagree about what a model already has.
   */
  extractTextures: TextureExtraction
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
  /** The project folder, read one level at a time. */
  folder: FolderReader
  /** Everything that WRITES to that folder, and the stack that takes a batch back. */
  files: FileOps
  /** The pass that puts the catalogue and the folder back in agreement — watched, never asked for. */
  reconciler: Reconciler
  /** The project's own context. Read straight off the disk, so no window holds a stale copy. */
  context: ProjectContextStore
  /** What makes the project a GAME — its manifest, and the scripts a Play compiles. */
  game: ProjectGameStore
  scripts: GameScriptStore
  /**
   * `shell.openPath`, which answers an empty string on success and a sentence on failure — and
   * this is the only place the studio launches a third-party application, so it is injected
   * like every other thing that leaves the process.
   */
  openInSystem: (file: string) => Promise<string>
  /** `dialog.showMessageBox`, injected for the same reason — see `documentDialogs`. */
  askUser: AskUser
  /**
   * How many generations are still running. Counted here rather than sent by the window: the
   * manager holds them, and a replica a beat behind would put a number in a dialog nobody could
   * check.
   */
  runningJobCount: () => number
}

export function registerProjectHandlers({
  project,
  record,
  assets,
  extractTextures,
  newAssetId,
  documents,
  reveal,
  exists,
  folder,
  files,
  reconciler,
  context,
  game,
  scripts,
  openInSystem,
  askUser,
  runningJobCount,
}: ProjectHandlerDeps): void {
  handle(CHANNELS.projectCreate, async (_event, path) => {
    // Parsed outside the try on purpose: an argument this channel refuses is not a sentence
    // about the folder, and `projectOpen` below draws the same line through `openFailureKey`.
    const root = parseProjectPath(path)

    try {
      // Inside, unlike the path above: this name comes from the FOLDER the user picked, not from
      // an argument, so a refusal is a sentence about their choice and owes them one. The root of
      // a volume has no name, and is turned away here by the rule that refuses a nameless one —
      // left outside, it failed in complete silence. Through `projectName`, never a second
      // basename of its own: the dialog would then spell `Été` in a form nothing else uses.
      const named = parseProjectTitle(projectName(root))

      const verdict = await project.inspect(root)

      // Creating again would stamp a fresh `createdAt` on a folder that has been worked in, and
      // hand its catalogue a new identity.
      if (verdict === 'project') return await project.open(root)

      // The one refusal that is the user's to give, so it is asked before anything is written.
      if (verdict === 'occupied' && !(await askUseOccupiedFolder(askUser, named))) return null

      return await project.create(root)
    } catch (error) {
      // Same silence as opening: `createPicked` watches nothing either, so a folder that could
      // not be written said nothing at all. The path is left out — the user picked it from a
      // dialog, and whatever `mkdir` says about it is not something they can act on.
      record({
        level: 'error',
        topic: 'project',
        messageKey: openFailureKey(error) ?? 'activity.projectNotCreated',
      })
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

  // `lastProject` is the renderer's own write, as forgetting a project already is — the settings
  // are replicated, so writing them here would be the same write twice. See `projectRename`.
  handle(CHANNELS.projectClose, () => project.close())

  // Its own channel because it has to be answerable BEFORE the window asks about unsaved
  // documents: answering for three documents and then being asked whether to leave at all is the
  // wrong order to put two questions in. Reached by all four ways out of a project.
  handle(CHANNELS.projectAskLeave, async () => {
    const running = runningJobCount()
    return running === 0 || (await askLeaveWithJobs(askUser, running))
  })

  handle(CHANNELS.projectRevealFile, async (_event, relative) => {
    reveal(join(project.path(), parseFolderPath(relative)))
  })

  // Parsed like every other path a window names, and for the same reason: a renderer says where
  // it wants to look, and `..` would look outside the folder the user opened.
  handle(CHANNELS.projectFileFacts, async (_event, relative) =>
    fileFactsOf(join(project.path(), parseFolderPath(relative))),
  )

  handle(CHANNELS.projectReadContext, async () => context.read())

  // Broadcast rather than returned alone: every window replicates the file, and one that kept
  // showing the cards of before would preview a generation nobody is going to get.
  handle(CHANNELS.projectWriteContext, async (_event, cards) => {
    const state = await context.write(parseContextCards(cards))
    broadcast(EVENTS.projectContext, state)
    return state
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

  /**
   * The PROJECT's name, which is its FOLDER's — so the folder MOVES. See the channel's doc.
   *
   * Broadcast rather than answered alone, and only for the project that is open: every window
   * replicates it, and the title bar of a second one would go on naming the old name. The
   * `recentProjects` entry is the renderer's own write, as forgetting a project already is — the
   * settings are replicated too, so doing it here would be the same write twice.
   */
  handle(CHANNELS.projectRename, async (_event, path, name) => {
    const folderPath = parseProjectPath(path)
    const title = parseProjectTitle(name)

    try {
      const renamed = await project.rename(folderPath, title)
      if (project.current()?.path === folderPath) broadcast(EVENTS.projectChanged, renamed)
      return renamed
    } catch (error) {
      // The folder can have gone or stopped opening since the shelf last saw it, which is the
      // same failure `projectOpen` reports — and the shelf is where a stale row lives.
      record({ level: 'error', topic: 'project', messageKey: 'activity.projectNotRenamed' })
      throw error
    }
  })

  /**
   * The seven gestures that write to the project folder, and the one that reads their history.
   *
   * All of them go through `files`, and none of them decides anything: what may be written is
   * settled in `filePlan.ts` against a reading of the folders taken before the first write.
   * The panel used to route a rename through three channels depending on what the row turned
   * out to be — six more gestures would have been that branch written six more times.
   *
   * **What comes back is a partial result**, never a boolean: two hundred and ninety-eight
   * rushes moved and two names already taken is what a file browser answers.
   */
  const settled = (outcome: FileOutcome): FileOutcome => {
    // Only what actually moved is worth waking every window for. A batch that refused everything
    // has already said so to the one that asked.
    if (outcome.done.length > 0) broadcast(EVENTS.filesChanged, outcome)
    if (outcome.refused.length > 0) {
      record({
        level: 'error',
        topic: 'project',
        messageKey: 'activity.filesRefused',
        params: { count: outcome.refused.length },
      })
    }
    return outcome
  }

  handle(CHANNELS.projectRenameFile, async (_event, relative, name) =>
    settled(await files.rename(parseFolderPath(relative), parseProjectName(name))),
  )

  handle(CHANNELS.projectMoveFiles, async (_event, paths, folderPath) =>
    settled(await files.move(parseFolderPaths(paths), parseFolderPath(folderPath))),
  )

  /**
   * The files go to the system's trash, and the rows that named them go with them.
   *
   * Asked first past one file, because this is the one gesture `undoFile` cannot take back —
   * see `askTrashFiles`. A refusal is an empty outcome rather than an error: a cancelled
   * gesture is not a failure, and nothing was written to say otherwise.
   */
  handle(CHANNELS.projectTrashFiles, async (_event, paths) => {
    const wanted = parseFolderPaths(paths)
    if (wanted.length > 1 && !(await askTrashFiles(askUser, wanted.length))) {
      return { done: [], refused: [], batch: '' }
    }

    return settled(await files.trash(wanted))
  })

  handle(CHANNELS.projectNewFolder, async (_event, folderPath, name) =>
    settled(await files.createFolder(parseFolderPath(folderPath), parseProjectName(name))),
  )

  handle(CHANNELS.projectDuplicateFiles, async (_event, paths) =>
    settled(await files.duplicate(parseFolderPaths(paths))),
  )

  // Cut moves, copy lays a copy down under a free name — one channel because the clipboard is
  // one gesture with two settings, and two channels would be two places to keep in step.
  handle(CHANNELS.projectPasteFiles, async (_event, paths, folderPath, cut) => {
    const wanted = parseFolderPaths(paths)
    const into = parseFolderPath(folderPath)
    return settled(
      cut === true ? await files.move(wanted, into) : await files.duplicate(wanted, into),
    )
  })

  handle(CHANNELS.projectUndoFile, async () => settled(await files.undo()))
  handle(CHANNELS.projectRedoFile, async () => settled(await files.redo()))
  // `async` for the same reason `projectListFolder` is: the other side awaits an invoke.
  handle(CHANNELS.projectFileHistory, async () => files.can())

  // A window never asks FOR a pass — opening a project and coming back to the front are what do.
  // What it may do is watch one and call it off.
  handle(CHANNELS.projectRescanState, async () => reconciler.state())
  // `async` for the same reason the listing above is: the other side awaits an invoke.
  handle(CHANNELS.projectFolderRoles, async () => project.roles())
  handle(CHANNELS.projectFolderFor, async (_event, role) =>
    project.folderFor(parseFolderRole(role)),
  )
  handle(CHANNELS.projectStopRescan, async () => reconciler.stop())

  // `async`, though it awaits nothing of its own: a refused path throws from `parseFolderPath`,
  // and a synchronous throw here would reach the caller as an exception rather than a rejected
  // invoke — which is not what the other side is written to catch.
  handle(CHANNELS.projectListFolder, async (_event, relative, hidden) =>
    folder.list(parseFolderPath(relative), parseHiddenShown(hidden)),
  )

  handle(CHANNELS.projectSearchFolder, async (_event, term, hidden) =>
    folder.search(parseSearchTerm(term), parseHiddenShown(hidden)),
  )

  handle(CHANNELS.projectWalkFolder, async (_event, hidden) =>
    folder.walk(parseHiddenShown(hidden)),
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

  handle(CHANNELS.assetsAbsent, async (_event, assetIds) => {
    const ids = parseAssetIds(assetIds)

    // Asked all at once, and that is the point: `find` is a round trip to the catalogue worker,
    // so a `for…await` over a window of sixty cells chains sixty of them — with a synchronous
    // `exists` wedged between each, on the process every window shares.
    const catalogue = project.catalog()
    const found = await Promise.all(ids.map(assetId => catalogue.find(assetId)))
    const root = project.path()

    // Through the injected `exists`, like every other thing here that touches the disk — and it
    // is what makes this testable without a file system.
    return (
      found
        .filter(asset => asset !== null)
        // A row that never had a file cannot have lost one: a cloud-only asset is elsewhere, not
        // absent, and marking it would put a warning on the one state that is fine.
        .filter(asset => {
          const file = ownFileOf(root, asset)
          return file !== null && !exists(file)
        })
        .map(asset => asset.id)
    )
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

  /**
   * The half `savePicture` and `saveLayered` share: overwrite the picture named, or land a new
   * one beside the source it derives from. Only the bytes and the extension tell the two apart,
   * and a rule fixed on one of them alone is what this exists to stop.
   */
  const landPicture = async (
    request: { name: string; replaces?: string; derivedFrom?: string },
    bytes: Uint8Array,
    extension: string,
    probe: MediaProbe | undefined,
  ): Promise<Asset> => {
    // Checked against the CATALOGUE, not against what was sent. `sourceAssetId` is read back
    // off a JSON envelope inside the project folder — user territory, like the manifest — and
    // `replaceBytes` builds its path from the row's own type: an id naming a take would write
    // `audio/<id>` under whichever extension landed here and `rm` the `.wav` beside it,
    // destroying a recording from a save on another document entirely.
    if (request.replaces) {
      const replaced = await project.catalog().find(request.replaces)
      if (!replaced || !PICTURES.includes(replaced.type)) {
        throw new Error(`asset ${request.replaces} is not a picture to overwrite`)
      }

      return withoutSourcePath(await assets.replaceBytes(request.replaces, bytes, extension, probe))
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
          extension,
          ...(probe ? { probe } : {}),
          ...(source?.map ? { map: source.map } : {}),
          ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
        },
        bytes,
      ),
    )
  }

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
    return landPicture(request, png, PNG_EXTENSION, probe)
  })

  handle(CHANNELS.assetsSaveLayered, async (_event, value) => {
    const request = parseSaveLayered(value)
    // Checked like `savePicture` checks its own, and it matters more here: `mergedimage.png` is
    // what every other application draws of this file, so bytes that are not a picture make a
    // container that opens as nothing — with the layers beside it, intact and unreachable.
    const merged = request.document.surfaces.find(one => one.path === ORA_MERGED_PATH)?.png
    if (!merged || !isPngBytes(merged)) throw new Error('expected a PNG payload')

    // The flatten reduced to the 256 px the spec allows, rather than the flatten again: written
    // whole it doubled the file and put it out of spec, and every read inflated the copy.
    const bytes = packOpenRaster(request.document, '', oraThumbnailOf(merged))
    // Read off the FLATTEN the container carries, not off the container: what the shelf and the
    // inspector show of a `.ora` is its `mergedimage.png`, and its dimensions are the picture's.
    const probe = probePng(merged) ?? undefined

    return landPicture(request, bytes, ORA_EXTENSION, probe)
  })

  handle(CHANNELS.assetsReadLayered, async (_event, value) => {
    const asset = await project.catalog().find(parseAssetId(value))
    // `ownFileOf`, like every reader here: a linked file is the user's own, and the container is
    // read from wherever they left it.
    const file = asset ? ownFileOf(project.path(), asset) : null
    if (!file?.toLowerCase().endsWith(ORA_EXTENSION)) return null

    try {
      return unpackOpenRaster(await readFile(file))
    } catch {
      // A `.ora` that will not unpack is a file to open as a flat picture rather than a tab that
      // refuses to appear — the caller falls back, and the container's own flatten still draws.
      return null
    }
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
          // A channel is a picture in the catalogue — `map`, set below, is what says which
          // channel it holds. Decided here and never sent by the renderer.
          type: 'image',
          extension: PNG_EXTENSION,
          map: request.map,
          ...(probe ? { probe } : {}),
          ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
        },
        request.png,
      ),
    )
  })

  /**
   * A model's own pictures, taken out into the project so the studio can act on them.
   *
   * Read and written HERE rather than in the window: the bytes are already a JPEG or a PNG, so
   * this is a file read and a copy — decoding them in the renderer to hand them back would cost
   * a re-encode that softens exactly what the model was painted with (invariant 6).
   */
  handle(CHANNELS.assetsExtractTextures, async (_event, value) => {
    const assetId = parseAssetId(value)
    const source = await project.catalog().find(assetId)
    if (!source || source.type !== 'mesh') throw new Error(`asset ${assetId} is not a mesh`)

    // The row catches up the models a project held before extracting was something an import did
    // on its own — and answers with what is already there for the ones that do not need it.
    return (await extractTextures(source)).map(withoutSourcePath)
  })

  handle(CHANNELS.gameRead, () => game.read())

  handle(CHANNELS.gameWrite, (_event, manifest) => game.write(parseGame(manifest)))

  handle(CHANNELS.gameScripts, () => scripts.list())

  handle(CHANNELS.gameWriteScript, (_event, path, source) =>
    scripts.write(parseFolderPath(path), String(source)),
  )

  handle(CHANNELS.documentList, () => documents.list())

  handle(CHANNELS.documentRead, (_event, id, kind) =>
    documents.read(parseDocumentId(id), parseDocumentKind(kind)),
  )

  handle(CHANNELS.documentWrite, async (_event, id, kind, draft, force, folder) => {
    const written = await documents.write(
      parseDocumentId(id),
      parseDocumentKind(kind),
      parseDocumentDraft(draft),
      parseForceWrite(force),
      parseLandingFolder(folder),
    )
    // After the save, never before: a manifest stamped for a document the disk refused would
    // say the project worked when nothing was written. A refused overwrite is that same case.
    if (written === 'written') project.touch()
    return written
  })

  handle(CHANNELS.documentRename, async (_event, id, kind, title) => {
    const renamed = await documents.rename(
      parseDocumentId(id),
      parseDocumentKind(kind),
      parseDocumentTitle(title),
    )
    // As the write does, and for the same reason: the manifest says the project was worked on,
    // and only once the disk has agreed.
    project.touch()
    return renamed
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

  handle(CHANNELS.documentConfirmFlatten, (_event, title, format, lost) =>
    askFlattenDocument(askUser, parseDocumentTitle(title), String(format), String(lost)),
  )

  handle(CHANNELS.documentConfirmOverwrite, (_event, title) =>
    askOverwriteDocument(askUser, parseDocumentTitle(title)),
  )
}
