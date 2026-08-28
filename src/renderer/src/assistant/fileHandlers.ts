import { refused, type ActionOutcome, type ActionRefusal } from '@shared/domain/assistant'
import { documentExtensionOf, isDocumentExtension } from '@shared/domain/document'
import { FOLDER_ROOT } from '@shared/domain/folder'
import type { StudioBridge } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { openProjectFile, type FileOpening } from '@/helpers/openProjectFile'
import { documentAtPath, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { withBridge, type ActionHandlers } from './actionHandler'
import { boolOf, textOf, textsOf } from './actionInputs'

/**
 * The project folder, walked and changed from outside the window.
 *
 * Every one of these goes through the channel the Explorer uses, so a batch lands in the file
 * undo stack and in the activity journal exactly as a drag would.
 */

/**
 * Runs against the OPEN project, refusing for the right one of two reasons.
 *
 * The two were answered as `noBridge` together at first, which told a client its window was
 * unreachable when the real answer was that a relative path had nothing to be relative to.
 */
function inProject(run: (bridge: StudioBridge) => Promise<unknown>): Promise<ActionOutcome> {
  if (!getBridge()) return Promise.resolve(refused('noBridge'))
  if (!useProject.getState().project) return Promise.resolve(refused('noProject'))

  return withBridge(run)
}

/**
 * The same, followed by the relist a write owes its next reader.
 *
 * The store learns of a batch through an event, but a client calling `files.list` in the very
 * next message would otherwise read the listing from before its own move — the round trip is
 * faster than the watcher.
 */
async function changing(run: (bridge: StudioBridge) => Promise<unknown>): Promise<ActionOutcome> {
  const outcome = await inProject(run)
  if (outcome.ok) await useDocuments.getState().relist('own-write')

  return outcome
}

/** Every path-taking action needs at least one; the registry holds the list to non-empty. */
function moving(
  input: Record<string, unknown>,
  run: (bridge: StudioBridge, paths: string[], folder: string) => Promise<unknown>,
): Promise<ActionOutcome> {
  return changing(bridge =>
    run(bridge, textsOf(input, 'paths'), textOf(input, 'folder') ?? FOLDER_ROOT),
  )
}

async function facts(input: Record<string, unknown>): Promise<ActionOutcome> {
  const outcome = await inProject(bridge =>
    bridge.project.fileFacts(textOf(input, 'path') ?? FOLDER_ROOT),
  )

  // `null` is the channel's answer for an entry that is not there. `notFound` rather than
  // `badInput`: the path was a well-formed string, and a client told otherwise retries the call.
  return outcome.ok && outcome.data === null ? refused('notFound') : outcome
}

/**
 * The endings that are refusals. The three that are not — a tab, an editor, another program —
 * answer `ok` and NAME which one: a model told `ok` alone reports a tab that is not there.
 */
const REFUSAL_OF_OPENING: Record<FileOpening, ActionRefusal | null> = {
  document: null,
  asset: null,
  system: null,
  folder: 'badInput',
  missing: 'notFound',
  unreachable: 'noBridge',
  failed: 'failed',
}

async function openFile(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')
  if (!useProject.getState().project) return refused('noProject')

  /**
   * The same re-read `document.open` does — a listing the client holds may predate a file that
   * has since arrived — but only where the answer could change: a listing holds documents alone,
   * so re-walking the project for a `.png` costs one head per document and can find nothing.
   */
  if (
    isDocumentExtension(documentExtensionOf(path)) &&
    !documentAtPath(useDocuments.getState(), path)
  ) {
    await useDocuments.getState().relist('own-write')
  }

  const opening = await openProjectFile(path)
  const refusal = REFUSAL_OF_OPENING[opening]

  return refusal ? refused(refusal) : { ok: true, data: { opened: opening } }
}

async function openProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  return (await useProject.getState().open(path)) ? { ok: true } : refused('badInput')
}

async function closeProject(): Promise<ActionOutcome> {
  const { project, close } = useProject.getState()
  if (!project) return refused('noProject')

  // Same shape as `document.close`, and for the same reason: the store raises the only question
  // that knows whether any work is at stake, so this action commits `none` and answers its no.
  return (await close()) ? { ok: true } : refused('declined')
}

async function createProject(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  // Through the store, which is what makes this the FOURTH way out of a project rather than the
  // one that slipped past its questions: it left the open project without asking about the
  // generations running in it, nor about any document holding unsaved work.
  const created = await useProject.getState().createAt(path)
  // `declined` rather than `badInput`, and it covers both nos: the question on the way out, and
  // the main process asking about a folder that already holds files. A client told its input was
  // wrong would retry a path that was never the problem.
  if (!created) return refused('declined')

  return { ok: true, data: created }
}

export const FILE_HANDLERS: ActionHandlers = {
  'project.open': openProject,
  'project.close': closeProject,
  'project.create': createProject,
  'file.facts': facts,
  'file.open': openFile,

  'files.list': input =>
    inProject(bridge =>
      bridge.project.listFolder(textOf(input, 'folder') ?? FOLDER_ROOT, boolOf(input, 'hidden')),
    ),

  'files.search': input =>
    inProject(bridge =>
      bridge.project.searchFolder(textOf(input, 'query') ?? '', boolOf(input, 'hidden')),
    ),

  'files.move': input =>
    moving(input, (bridge, paths, folder) => bridge.project.moveFiles(paths, folder)),

  // `cut: false` is the copy. The channel is the Explorer's paste, which is why it takes a flag
  // rather than there being two of them.
  'files.copy': input =>
    moving(input, (bridge, paths, folder) => bridge.project.pasteFiles(paths, folder, false)),

  'files.duplicate': input =>
    changing(bridge => bridge.project.duplicateFiles(textsOf(input, 'paths'))),

  'files.trash': input => changing(bridge => bridge.project.trashFiles(textsOf(input, 'paths'))),

  'file.rename': input =>
    changing(bridge =>
      bridge.project.renameFile(textOf(input, 'path') ?? '', textOf(input, 'name') ?? ''),
    ),

  'folder.new': input =>
    changing(bridge =>
      bridge.project.newFolder(textOf(input, 'folder') ?? '', textOf(input, 'name') ?? ''),
    ),

  'files.undo': () => changing(bridge => bridge.project.undoFile()),

  'files.redo': () => changing(bridge => bridge.project.redoFile()),

  'files.history': () => inProject(bridge => bridge.project.fileHistory()),

  'file.reveal': input =>
    inProject(bridge => bridge.project.revealFile(textOf(input, 'path') ?? '')),

  /**
   * Through the store rather than the channel, and not `inProject`: the path is absolute and
   * names a project that need not be the open one. The store is what puts the new name on the
   * open project and in the recent list — the broadcast behind the channel reaches OTHER windows,
   * so the one that served this call would have kept the old name for good.
   */
  'project.rename': async input => {
    const renamed = await useProject
      .getState()
      .rename(textOf(input, 'path') ?? '', textOf(input, 'name') ?? '')

    return renamed ? { ok: true } : refused('failed')
  },
}
